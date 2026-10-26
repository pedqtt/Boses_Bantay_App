from pathlib import Path
import unittest
from unittest.mock import patch
import streamlit as st
from streamlit.testing.v1 import AppTest
from service_controller import Service

class FakeController:
    def __init__(self):self.actions=[]
    def services(self):return [Service(key,title,'Test service',port,'') for key,title,port in [('expo','Expo',8081),('api','Chatbot API',8503),('whisper','Whisper',8000),('ollama','Ollama',11434)]]
    def snapshot(self):return {}
    def status(self,service,snapshot):return {'label':'Running','running':True,'targets':[{}]}
    def start(self,key):self.actions.append(('start',key));return 'Started'
    def stop(self,key):self.actions.append(('stop',key));return 'Stopped'
    def start_all(self):self.actions.append(('start','all'));return ['Started all']
    def stop_all(self):self.actions.append(('stop','all'));return ['Stopped all']
    def log_tail(self,key):return 'Test log'
    def logs(self,key,**filters):return {'text':'Synthetic '+key+' log','files':['test.log'],'errors':0,'warnings':0}
    def expo_info(self,snapshot):return {'ready':False,'message':'Start Expo to show its QR code.'}

class DashboardTests(unittest.TestCase):
    def setUp(self):st.cache_resource.clear();self.fake=FakeController()
    def open(self):
        app=AppTest.from_file(str(Path(__file__).with_name('control_dashboard.py')))
        with patch('service_controller.ServiceController',return_value=self.fake):app.run(timeout=30)
        self.assertFalse(app.exception);return app
    def test_opening_panel_has_no_start_stop_side_effect(self):
        self.open();self.assertEqual(self.fake.actions,[])
    def test_stopping_whisper_only_targets_whisper(self):
        app=self.open();app.button(key='stop-whisper').click().run(timeout=30)
        self.assertFalse(app.exception);self.assertEqual(self.fake.actions,[('stop','whisper')])
    def test_stop_all_is_explicit(self):
        app=self.open();app.button(key='stop-all').click().run(timeout=30)
        self.assertFalse(app.exception);self.assertEqual(self.fake.actions,[('stop','all')])

    def test_all_server_log_tabs_are_visible(self):
        app=self.open()
        self.assertEqual([tab.label for tab in app.tabs],['Expo','Chatbot API','Whisper','Ollama','Control panel','All servers'])
        self.assertEqual(self.fake.actions,[])

    def test_running_expo_shows_scannable_link_without_starting_servers(self):
        import base64
        self.fake.expo_info=lambda snapshot:{'ready':True,'url':'exp://192.168.1.5:8081','web_url':'http://192.168.1.5:8081','port':8081,'sdk':'57.0.0'}
        self.fake.expo_qr=lambda url:base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlT0AAAAASUVORK5CYII=')
        app=self.open()
        self.assertTrue(any(code.value=='exp://192.168.1.5:8081' for code in app.code))
        self.assertEqual(self.fake.actions,[])

if __name__=='__main__':unittest.main()
