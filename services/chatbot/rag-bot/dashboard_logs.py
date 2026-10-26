"""Bounded, redacted log collection for all local service streams."""
from datetime import datetime, timezone, timedelta
import json
import os
from pathlib import Path
import re

from dotenv import dotenv_values

ERROR=re.compile(r'\b(?:error|exception|failed|failure|traceback|fatal)\b|\b[45]\d\d\b',re.I)
WARNING=re.compile(r'\b(?:warn|warning|deprecated)\b',re.I)


class DashboardLogs:
    def __init__(self,private,project,settings):
        self.private,self.project,self.settings=private,project,settings

    def sources(self,service):
        names={
            'expo':['control-expo.log','expo-mobile.log'],
            'api':['control-api.log','startup-mobile-api.log','mobile-api.log','mobile-api-error.log','chat-runtime.log','chat-runtime.log.1','chat-runtime.log.2'],
            'whisper':['control-whisper.log','startup-whisper.log'],
            'ollama':['control-ollama.log','startup-ollama.log'],
            'panel':['control-dashboard.log','service-control.log'],
        }
        if service not in names:raise ValueError('Unknown service')
        candidates=[self.private/name for name in names[service]]
        if service=='expo':candidates += [self.project/'.expo/dev/logs/start.log',self.project/'.expo/dev/logs/export.log']
        if service=='ollama':
            folder=Path(os.environ.get('LOCALAPPDATA',''))/'Ollama'
            candidates += sorted(folder.glob('server*.log'))+sorted(folder.glob('app*.log'))
        if service=='whisper':
            folder=Path(self.settings.get('WHISPER_SERVICE_DIR') or self.project.parent/'whisper-server')
            candidates += sorted(folder.glob('*.log'))
        return sorted({p for p in candidates if p.is_file()},key=lambda p:p.stat().st_mtime,reverse=True)

    def redact(self,text):
        for values in [self.settings,dotenv_values(self.project/'.env')]:
            for name,value in values.items():
                if value and len(value)>6 and re.search(r'KEY|TOKEN|SECRET|PASSWORD',name,re.I):text=text.replace(value,'[redacted]')
        text=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',text)
        text=re.sub(r'\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}','[redacted JWT]',text)
        text=re.sub(r'\bsb_secret_[A-Za-z0-9_-]{12,}','[redacted]',text)
        text=re.sub(r'(?i)(authorization\s*[:=]\s*(?:bearer\s+)?)[^\s,\r\n]+',r'\1[redacted]',text)
        text=re.sub(r'(?i)([\w-]*(?:api[_-]?key|password|secret|_key|_token)[\w-]*["\x27]?\s*[:=]\s*)["\x27]?[^\s,}\r\n]+',r'\1[redacted]',text)
        return text

    def format_line(self,line,verbose):
        try:event=json.loads(line)
        except ValueError:return line
        if not isinstance(event,dict) or '_e' not in event:return line
        kind=event['_e']
        if kind=='env:load':return 'Expo environment loaded (values hidden).'
        if kind=='metro:bundling:progress' and not verbose:return None
        stamp=''
        if isinstance(event.get('_t'),(int,float)):
            stamp=datetime.fromtimestamp(event['_t']/1000,timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M:%S')+' '
        if kind=='metro:client_log':
            data=event.get('data',[])
            detail=' '.join(v if isinstance(v,str) else json.dumps(v,ensure_ascii=False) for v in data) if isinstance(data,list) else str(data)
            return stamp+'PHONE '+str(event.get('level','info')).upper()+' '+detail
        fields={k:v for k,v in event.items() if k not in {'_e','_t','env'}}
        return stamp+str(kind)+' '+json.dumps(fields,ensure_ascii=False)

    def collect(self,service,lines=250,level='all',search='',verbose=False):
        lines=max(20,min(int(lines),1000)); sections=[]; files=[]; errors=warnings=0
        for source in self.sources(service):
            try:
                with source.open('rb') as stream:
                    stream.seek(0,2); stream.seek(max(0,stream.tell()-256000)); raw=stream.read().decode('utf-8',errors='replace')
            except OSError:continue
            formatted=[]
            for line in raw.splitlines():
                value=self.format_line(line,verbose)
                if value is not None:formatted.extend(self.redact(value).splitlines())
            formatted=formatted[-lines:]
            errors+=sum(bool(ERROR.search(line)) for line in formatted)
            warnings+=sum(bool(WARNING.search(line)) for line in formatted)
            selected=set()
            for index,line in enumerate(formatted):
                if level=='errors' and not ERROR.search(line):continue
                if level=='warnings' and not WARNING.search(line):continue
                if search and search.casefold() not in line.casefold():continue
                # Preserve neighbouring lines for useful stack-trace context.
                if level!='all' or search:selected.update(range(max(0,index-2),min(len(formatted),index+7)))
                else:selected.add(index)
            shown='\n'.join(formatted[i] for i in sorted(selected))
            label=source.name
            if source.parent==self.project/'.expo/dev/logs':label='Expo events / '+label
            elif source.parent.name=='Ollama':label='Ollama runtime / '+label
            files.append(label)
            if shown.strip():sections.append('--- '+label+' ---\n'+shown)
        text='\n\n'.join(sections)
        if not text:text='No matching log entries yet. Start the server from this panel, or change the filters.'
        return {'text':text,'files':files,'errors':errors,'warnings':warnings}
