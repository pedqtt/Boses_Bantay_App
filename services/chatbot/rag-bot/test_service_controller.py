from pathlib import Path
from unittest.mock import patch
import unittest
from service_controller import ServiceController, BACKEND, PROJECT, STOP_SCRIPT

def process(pid,parent,command,name='python.exe',started='2026-10-25T10:00:00Z'):
    return dict(pid=pid,parent=parent,command=command,name=name,started=started,executable='C:/runtime/'+name)

class ServiceControlTests(unittest.TestCase):
    def setUp(self):
        self.controller=ServiceController()
        self.settings={'RAG_API_KEY':'synthetic-key-'*3}
        self.patch=patch.object(self.controller,'settings',return_value=self.settings);self.patch.start();self.addCleanup(self.patch.stop)
        self.services={s.id:s for s in self.controller.services()}

    def test_api_control_does_not_match_dashboard_or_unrelated_python(self):
        api=process(100,0,f'"{BACKEND}/.venv/Scripts/python.exe" mobile_api.py --port 8503')
        dashboard=process(101,0,f'"{BACKEND}/.venv/Scripts/python.exe" -m streamlit run control_dashboard.py')
        other=process(102,0,'C:/other/python.exe mobile_api.py --port 8503')
        selected=self.controller.targets(self.services['api'],{'processes':[api,dashboard,other]})
        self.assertEqual([p['pid'] for p in selected],[100])

    def test_expo_includes_its_workers_but_not_other_projects_or_reused_parent_ids(self):
        root=process(100,0,f'node "{PROJECT}/node_modules/expo/bin/cli" start --lan',name='node.exe')
        child=process(101,100,'node worker.js',name='node.exe')
        unrelated=process(102,0,'node C:/other/node_modules/expo/bin/cli start',name='node.exe')
        stale=process(103,100,'node old-worker.js',name='node.exe',started='2026-10-24T00:00:00Z')
        selected=self.controller.targets(self.services['expo'],{'processes':[root,child,unrelated,stale]})
        self.assertEqual({p['pid'] for p in selected},{100,101})

    def test_whisper_is_scoped_to_configured_python_and_port(self):
        directory=PROJECT.parent/'whisper-server'
        good=process(1,0,f'"{directory}/venv/Scripts/python.exe" -m uvicorn app:app --port 8000')
        bad=process(2,0,f'"{directory}/venv/Scripts/python.exe" -m uvicorn app:app --port 9000')
        self.assertTrue(self.controller.matches(self.services['whisper'],good))
        self.assertFalse(self.controller.matches(self.services['whisper'],bad))

    def test_unknown_port_owner_cannot_be_stopped_or_overwritten(self):
        snapshot={'processes':[],'ports':[{'port':8503,'pid':99}]}
        with patch.object(self.controller,'snapshot',return_value=snapshot),patch('service_controller.subprocess.Popen') as spawn:
            with self.assertRaisesRegex(RuntimeError,'another process'):self.controller.start('api')
            self.assertIn('already stopped',self.controller.stop('api'))
        spawn.assert_not_called()

    def test_stop_passes_exact_process_fingerprints_for_revalidation(self):
        api=process(100,0,f'"{BACKEND}/.venv/Scripts/python.exe" mobile_api.py --port 8503')
        with patch.object(self.controller,'snapshot',return_value={'processes':[api],'ports':[]}),patch.object(self.controller,'powershell',return_value=[{'pid':100,'stopped':True}]) as stop:
            self.assertEqual(self.controller.stop('api'),'Chatbot API stopped.')
        self.assertIn('started',stop.call_args.kwargs['env']['BB_CONTROL_TARGETS'])
        self.assertIn('$stamp -cne $target.started',STOP_SCRIPT)
        self.assertIn('CommandLine -cne',STOP_SCRIPT)

    def test_changed_process_is_not_reported_as_stopped(self):
        api=process(100,0,f'"{BACKEND}/.venv/Scripts/python.exe" mobile_api.py')
        with patch.object(self.controller,'snapshot',return_value={'processes':[api],'ports':[]}),patch.object(self.controller,'powershell',return_value=[{'pid':100,'stopped':False}]):
            with self.assertRaisesRegex(RuntimeError,'left alone'):self.controller.stop('api')

    def test_repeated_start_does_not_duplicate_running_service(self):
        api=process(100,0,f'"{BACKEND}/.venv/Scripts/python.exe" mobile_api.py')
        with patch.object(self.controller,'snapshot',return_value={'processes':[api],'ports':[]}),patch('service_controller.subprocess.Popen') as spawn:
            self.assertIn('already running',self.controller.start('api'))
        spawn.assert_not_called()

if __name__=='__main__':unittest.main()
