import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from dashboard_logs import DashboardLogs

class LogTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.project=Path(self.temp.name);self.private=self.project/'.private';self.private.mkdir()
        self.logs=DashboardLogs(self.private,self.project,{'RAG_API_KEY':'synthetic-private-key-123'})

    def test_reads_multiple_output_and_runtime_streams(self):
        (self.private/'control-api.log').write_text('stdout test\n',encoding='utf-8')
        (self.private/'mobile-api-error.log').write_text('ERROR socket test\n',encoding='utf-8')
        (self.private/'chat-runtime.log').write_text('INFO request_id=abcd route=/api/chat status=200\n',encoding='utf-8')
        value=self.logs.collect('api')
        self.assertEqual(len(value['files']),3)
        self.assertIn('stdout test',value['text']);self.assertIn('request_id=abcd',value['text'])

    def test_redacts_known_keys_and_drops_expo_environment_payload(self):
        folder=self.project/'.expo/dev/logs';folder.mkdir(parents=True)
        env={'_e':'env:load','env':{'SOME_OLD_KEY':'should-not-be-displayed'}}
        error={'_e':'metro:client_log','_t':100000,'level':'error','data':['failure synthetic-private-key-123']}
        (folder/'start.log').write_text(json.dumps(env)+'\n'+json.dumps(error),encoding='utf-8')
        value=self.logs.collect('expo')['text']
        self.assertNotIn('should-not-be-displayed',value);self.assertNotIn('synthetic-private-key-123',value)
        self.assertIn('PHONE ERROR',value)

    def test_error_filter_keeps_trace_context_and_search(self):
        lines=['INFO start','INFO before','ERROR synthetic failure','Traceback','  diagnostic detail','INFO completed']
        (self.private/'control-whisper.log').write_text('\n'.join(lines),encoding='utf-8')
        value=self.logs.collect('whisper',level='errors',search='failure')
        self.assertIn('diagnostic detail',value['text']);self.assertGreater(value['errors'],0)

    def test_progress_is_optional_and_no_unknown_paths(self):
        folder=self.project/'.expo/dev/logs';folder.mkdir(parents=True)
        (folder/'start.log').write_text(json.dumps({'_e':'metro:bundling:progress','progress':.5}),encoding='utf-8')
        self.assertNotIn('bundling:progress',self.logs.collect('expo')['text'])
        self.assertIn('bundling:progress',self.logs.collect('expo',verbose=True)['text'])
        with self.assertRaises(ValueError):self.logs.collect('../../.env')

    def test_ollama_tray_server_logs_are_available(self):
        folder=self.project/'Ollama';folder.mkdir()
        (folder/'server.log').write_text('runner diagnostic test\n',encoding='utf-8')
        with patch.dict('os.environ',{'LOCALAPPDATA':str(self.project)}):value=self.logs.collect('ollama')
        self.assertIn('runner diagnostic test',value['text'])

if __name__=='__main__':unittest.main()
