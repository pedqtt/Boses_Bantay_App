import json
import unittest
from unittest.mock import patch
import start_all


class LauncherTests(unittest.TestCase):
    def setUp(self):
        env={'RAG_API_KEY':'test-'*8,'EXPO_PUBLIC_RAG_API_KEY':'test-'*8,
             'SUPABASE_URL':'https://test.invalid','SUPABASE_SERVICE_ROLE_KEY':'private-test',
             'EXPO_PUBLIC_RAG_API_URL':'http://192.168.1.5:8503'}
        self.patches=[patch('start_all.dotenv_values',return_value=env),
            patch('start_all.shutil.which',return_value='C:/tools/runtime.exe'),
            patch('start_all.Path.is_file',return_value=True),
            patch('start_all.socket.socket',side_effect=OSError),
            patch('start_all.set_key'),patch('start_all.hidden_process'),
            patch('start_all.subprocess.call',return_value=0)]
        self.mocks=[p.start() for p in self.patches]
        self.addCleanup(patch.stopall)

    def ready(self,url):
        if url.endswith('/api/tags'): return json.dumps({'models':[{'name':'qwen3:8b'},{'name':'nomic-embed-text:latest'}]})
        if ':8000/' in url: return json.dumps({'status':'ok','model':'large-v3'})
        if url.endswith('/health'): return json.dumps({'service':'boses-rag-mobile'})
        return 'packager-status:running'

    def test_check_has_no_side_effects(self):
        with patch('sys.argv',['start_all','--check']),patch('start_all.read_url') as read:
            self.assertEqual(start_all.main(),0)
        read.assert_not_called(); self.mocks[4].assert_not_called(); self.mocks[5].assert_not_called()

    def test_running_services_are_reused(self):
        with patch('sys.argv',['start_all']),patch('start_all.read_url',side_effect=self.ready):
            self.assertEqual(start_all.main(),0)
        self.mocks[5].assert_not_called(); self.mocks[6].assert_not_called()

    def test_foreground_expo_uses_argument_list_and_project_directory(self):
        def read(url): return None if url.endswith('/status') else self.ready(url)
        with patch('sys.argv',['start_all']),patch('start_all.read_url',side_effect=read):
            self.assertEqual(start_all.main(),0)
        args,kwargs=self.mocks[6].call_args
        self.assertEqual(args[0][2:],['start','--lan','--port','8081','--max-workers','2'])
        self.assertEqual(kwargs['cwd'],start_all.PROJECT)
        self.assertNotIn('shell',kwargs)

    def test_unrelated_service_on_api_port_is_not_stopped(self):
        def read(url): return 'other service' if url.endswith('/health') else self.ready(url)
        with patch('sys.argv',['start_all']),patch('start_all.read_url',side_effect=read):
            with self.assertRaisesRegex(RuntimeError,'another service'): start_all.main()
        self.mocks[5].assert_not_called()

    def test_missing_models_fail_with_pull_instruction(self):
        with patch('sys.argv',['start_all']),patch('start_all.read_url',return_value='{"models":[]}'):
            with self.assertRaisesRegex(RuntimeError,'ollama pull qwen3:8b'): start_all.main()
        self.mocks[5].assert_not_called()

    def test_tunnel_uses_separate_port_and_preserves_cache(self):
        def read(url): return None if url.endswith('/status') else self.ready(url)
        with patch('sys.argv',['start_all','--tunnel']),patch('start_all.read_url',side_effect=read):
            self.assertEqual(start_all.main(),0)
        arguments=self.mocks[6].call_args.args[0]
        self.assertIn('--tunnel',arguments)
        self.assertIn('8082',arguments)
        self.assertNotIn('--clear',arguments)

    def test_voice_starts_existing_worker_on_loopback_with_matching_key(self):
        with patch('start_all.read_url',return_value=None),patch('start_all.wait_ready') as wait:
            start_all.ensure_voice({},'shared-test-key')
        arguments=self.mocks[5].call_args.args[0]
        options=self.mocks[5].call_args.kwargs
        self.assertEqual(arguments[-4:],['--host','127.0.0.1','--port','8000'])
        self.assertEqual(options['cwd'],start_all.PROJECT.parent/'whisper-server')
        self.assertEqual(options['env']['WHISPER_API_KEY'],'shared-test-key')
        wait.assert_called_once()

    def test_voice_reuses_ready_worker_without_starting_ngrok(self):
        with patch('start_all.read_url',return_value='{"status":"ok","model":"large-v3"}'):
            start_all.ensure_voice({},'shared-test-key')
        self.mocks[5].assert_not_called()

if __name__=='__main__': unittest.main()
