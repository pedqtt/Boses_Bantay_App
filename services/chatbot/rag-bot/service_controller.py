"""Local Windows service controls with project/path and PID-reuse checks."""
from dataclasses import dataclass
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import threading
from urllib.parse import urlparse

from dotenv import dotenv_values
from start_all import BACKEND, PROJECT, voice_settings
from dashboard_logs import DashboardLogs
from expo_connection import expo_connection, qr_png
from datetime import datetime, timezone, timedelta

SNAPSHOT_SCRIPT = r'''
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'
$processes = @(Get-CimInstance Win32_Process | ForEach-Object {
  [pscustomobject]@{pid=[int]$_.ProcessId; parent=[int]$_.ParentProcessId; name=$_.Name;
    executable=$_.ExecutablePath; command=$_.CommandLine;
    started=$(if ($_.CreationDate) {$_.CreationDate.ToUniversalTime().ToString('o')} else {''})}
})
$ports = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  [pscustomobject]@{port=[int]$_.LocalPort; pid=[int]$_.OwningProcess}
})
@{processes=$processes; ports=$ports} | ConvertTo-Json -Depth 4 -Compress
'''

STOP_SCRIPT = r'''
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'
$targets = ConvertFrom-Json $env:BB_CONTROL_TARGETS
$results = @(foreach ($target in $targets) {
  $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($target.pid)" -ErrorAction SilentlyContinue
  if (-not $current) { continue }
  $stamp = $current.CreationDate.ToUniversalTime().ToString('o')
  if ($stamp -cne $target.started -or $current.CommandLine -cne $target.command -or $current.ExecutablePath -cne $target.executable) {
    [pscustomobject]@{pid=$target.pid; stopped=$false}; continue
  }
  Stop-Process -Id $target.pid -Force -ErrorAction Stop
  [pscustomobject]@{pid=$target.pid; stopped=$true}
})
ConvertTo-Json -InputObject $results -Compress
'''


def normalized(value):
    return str(value or '').replace('\\','/').casefold()


@dataclass(frozen=True)
class Service:
    id: str
    title: str
    description: str
    port: int
    health: str


class ServiceController:
    def __init__(self):
        self.lock = threading.RLock()
        self.private = BACKEND / '.private'
        self.private.mkdir(exist_ok=True)

    def settings(self):
        return dotenv_values(BACKEND / '.env')

    def services(self):
        env = self.settings()
        voice = urlparse(env.get('VOICE_UPSTREAM_URL') or 'http://127.0.0.1:8000')
        ollama = urlparse(env.get('OLLAMA_HOST') or 'http://localhost:11434')
        return [
            Service('expo','Expo','Mobile app development server',8081,'http://127.0.0.1:8081/status'),
            Service('api','Chatbot API','Shared chat and transcription address',8503,'http://127.0.0.1:8503/health'),
            Service('whisper','Whisper','Audio transcription worker',voice.port or 8000,'http://127.0.0.1:'+str(voice.port or 8000)+'/health'),
            Service('ollama','Ollama','Local AI models for chat and report helpers',ollama.port or 11434,(env.get('OLLAMA_HOST') or 'http://localhost:11434').rstrip('/')+'/api/tags'),
        ]

    def powershell(self, script, env=None):
        executable = Path(os.environ.get('SystemRoot','C:/Windows')) / 'System32/WindowsPowerShell/v1.0/powershell.exe'
        result = subprocess.run([str(executable),'-NoProfile','-NonInteractive','-Command',script],
            capture_output=True,text=True,encoding='utf-8-sig',timeout=25,env=env,
            creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode:
            raise RuntimeError('Windows could not inspect or control the selected service. Run this panel using the same Windows account that started it.')
        return json.loads(result.stdout or '[]')

    def snapshot(self):
        return self.powershell(SNAPSHOT_SCRIPT)

    def matches(self, service, process):
        command = normalized(process.get('command'))
        name = (process.get('name') or '').casefold()
        if not process.get('started') or not command or process['pid'] == os.getpid():
            return False
        if service.id == 'expo':
            return name == 'node.exe' and (
                normalized(PROJECT/'node_modules/expo/bin/cli') in command or
                (normalized(PROJECT/'node_modules/@expo/cli') in command)
            ) and bool(re.search(r'\bstart\b', command))
        if service.id == 'api':
            return name in {'python.exe','pythonw.exe'} and normalized(BACKEND) in command and bool(re.search(r'\bmobile_api\.py\b',command))
        if service.id == 'launcher':
            return name in {'python.exe','pythonw.exe'} and normalized(BACKEND) in command and bool(re.search(r'\bstart_all\.py\b',command))
        if service.id == 'whisper':
            env = self.settings()
            directory = Path(env.get('WHISPER_SERVICE_DIR') or PROJECT.parent/'whisper-server')
            python_paths = [env.get('WHISPER_PYTHON'),directory/'venv/Scripts/python.exe',directory/'.venv/Scripts/python.exe']
            return name in {'python.exe','pythonw.exe'} and any(normalized(p) in command for p in python_paths if p) and bool(re.search(r'\buvicorn\s+app:app\b',command)) and bool(re.search(r'--port\s+'+str(service.port)+r'\b',command))
        if service.id == 'ollama':
            host = urlparse(self.settings().get('OLLAMA_HOST') or 'http://localhost:11434').hostname
            if host not in {'localhost','127.0.0.1'}: return False
            candidates = [Path(os.environ.get('LOCALAPPDATA',''))/'Programs/Ollama']
            found = shutil.which('ollama')
            if found: candidates.append(Path(found).parent)
            server = name=='ollama app.exe' or (name=='ollama.exe' and bool(re.search(r'\b(?:serve|runner)\b',command)))
            return server and any(normalized(p)+'/' in command for p in candidates)
        return False

    def targets(self, service, snapshot):
        processes = snapshot.get('processes') or []
        selected = {p['pid']:p for p in processes if self.matches(service,p)}
        # Only descendants of a verified service process are included, never
        # arbitrary node/python processes or the control panel's parent.
        changed = True
        while changed:
            changed = False
            for p in processes:
                if p.get('parent') in selected and p['pid'] not in selected and p['pid'] != os.getpid() and p.get('started') and p.get('command'):
                    if p['started'] >= selected[p['parent']]['started']:
                        selected[p['pid']] = p; changed = True
        return list(selected.values())

    def status(self, service, snapshot):
        targets = self.targets(service,snapshot)
        owners = {p['pid'] for p in snapshot.get('ports',[]) if p['port'] == service.port}
        if targets:
            allowed_ports={service.port,8082} if service.id=='expo' else {service.port}
            listening = any(p['pid'] in {t['pid'] for t in targets} and p['port'] in allowed_ports for p in snapshot.get('ports',[]))
            return {'label':'Running' if listening else 'Starting / not listening','running':True,'targets':targets}
        if owners: return {'label':'Port in use by another process','running':False,'targets':[]}
        return {'label':'Stopped','running':False,'targets':[]}

    def start(self, service_id):
        with self.lock:
            service = next(s for s in self.services() if s.id == service_id)
            state = self.status(service,self.snapshot())
            if state['running']: return service.title+' is already running.'
            if state['label'] != 'Stopped': raise RuntimeError(f'Port {service.port} belongs to another process; it was left alone.')
            env = os.environ.copy(); settings = self.settings(); cwd = PROJECT
            env['PYTHONUNBUFFERED']='1'
            key = settings.get('RAG_API_KEY') or ''
            if service_id == 'api':
                if len(key)<24: raise RuntimeError('Configure RAG_API_KEY in the private backend .env first.')
                for k,v in settings.items():
                    if v is not None: env[k] = v
                arguments = [str(BACKEND/'.venv/Scripts/python.exe'),str(BACKEND/'mobile_api.py'),'--host','0.0.0.0','--port',str(service.port)]
                cwd = BACKEND
            elif service_id == 'whisper':
                if len(key)<24: raise RuntimeError('Configure the chatbot key before starting Whisper.')
                cwd, python = voice_settings(settings)
                arguments = [str(python),'-m','uvicorn','app:app','--host','127.0.0.1','--port',str(service.port)]
                env['WHISPER_API_KEY'] = settings.get('VOICE_UPSTREAM_API_KEY') or key
                env['OLLAMA_MODEL'] = settings.get('VOICE_LLM_MODEL') or 'qwen3:8b'
                env['HF_HUB_OFFLINE'] = '1'
                for k in ['WHISPER_MODEL','WHISPER_DEVICE','WHISPER_COMPUTE_TYPE','WHISPER_LANGUAGE']:
                    if settings.get(k): env[k] = settings[k]
            elif service_id == 'ollama':
                target = urlparse(settings.get('OLLAMA_HOST') or 'http://localhost:11434')
                if target.hostname not in {'localhost','127.0.0.1'}: raise RuntimeError('This panel cannot start a remote Ollama server.')
                executable = shutil.which('ollama') or str(Path(os.environ.get('LOCALAPPDATA',''))/'Programs/Ollama/ollama.exe')
                arguments = [executable,'serve']; env['OLLAMA_HOST'] = settings.get('OLLAMA_HOST') or 'http://localhost:11434'
            else:
                node = shutil.which('node')
                if not node: raise RuntimeError('Node.js is not installed or is missing from PATH.')
                arguments = [node,str(PROJECT/'node_modules/expo/bin/cli'),'start','--lan','--port',str(service.port),'--max-workers','2']
                for k in ['EXPO_PUBLIC_RAG_API_URL','EXPO_PUBLIC_RAG_API_KEY','REACT_NATIVE_PACKAGER_HOSTNAME','EXPO_PACKAGER_PROXY_URL']:
                    env.pop(k,None)
            with (self.private/f'control-{service_id}.log').open('ab') as log:
                process=subprocess.Popen(arguments,cwd=cwd,env=env,stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW)
            self.record_event(service_id,f'Start requested; PID {process.pid}.')
            return service.title+' is starting. Its status will update shortly.'

    def stop(self, service_id):
        with self.lock:
            service = next(s for s in self.services() if s.id == service_id)
            targets = self.targets(service,self.snapshot())
            if not targets: return service.title+' is already stopped (or not managed by this project).'
            result=self.stop_targets(targets,service.title)
            self.record_event(service_id,'Stopped verified service processes.')
            return result

    def stop_targets(self, targets, title):
        # Stop the Ollama tray supervisor first to prevent auto-restart;
        # then stop children before other parent processes.
        targets.sort(key=lambda p: (0 if p.get('name','').casefold()=='ollama app.exe' else 1, -p['pid']))
        env = os.environ.copy(); env['BB_CONTROL_TARGETS'] = json.dumps(targets)
        results = self.powershell(STOP_SCRIPT,env=env)
        if isinstance(results,dict): results=[results]
        if any(not item.get('stopped') for item in results):
            raise RuntimeError('A process changed before shutdown and was left alone. Refresh the panel and try again.')
        return title+' stopped.'

    def start_all(self):
        with self.lock:
            return [self.start(key) for key in ['ollama','whisper','api','expo']]

    def stop_all(self):
        with self.lock:
            messages=[]
            # A running one-click starter must not relaunch a service while
            # Stop all is shutting it down. The dashboard itself is excluded.
            launcher=Service('launcher','Startup launcher','',0,'')
            targets=self.targets(launcher,self.snapshot())
            if targets: messages.append(self.stop_targets(targets,launcher.title))
            for key in ['expo','api','whisper','ollama']:
                try: messages.append(self.stop(key))
                except Exception as error: messages.append(str(error))
            return messages

    def expo_info(self,snapshot):
        service=next(s for s in self.services() if s.id=='expo')
        targets=self.targets(service,snapshot);ids={p['pid'] for p in targets}
        allowed={8081,8082}
        for target in targets:
            match=re.search(r'--port\s+(\d+)',target.get('command') or '')
            if match:allowed.add(int(match[1]))
        ports={item['port'] for item in snapshot.get('ports',[]) if item['pid'] in ids and item['port'] in allowed}
        return expo_connection(ports,PROJECT)

    def expo_qr(self,url):
        return qr_png(url,PROJECT)

    def logs(self,service_id,**filters):
        return DashboardLogs(self.private,PROJECT,self.settings()).collect(service_id,**filters)

    def log_tail(self,service_id):
        return self.logs(service_id,lines=24)['text']

    def record_event(self,service_id,message):
        line=datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds')+f' [{service_id}] '+message+'\n'
        with (self.private/'service-control.log').open('a',encoding='utf-8') as output:output.write(line)
