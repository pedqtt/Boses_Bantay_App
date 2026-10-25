from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch

from streamlit.testing.v1 import AppTest
from chat import ChatEvent, Passage
from sessions import MemorySessionStore, SQLiteSessionStore


APP = str(Path(__file__).with_name('app.py'))


class SessionUITests(unittest.TestCase):
    def open(self, store, binding):
        app = AppTest.from_file(APP)
        app.query_params['chat'] = binding
        with patch('sessions.default_store', return_value=store):
            app.run(timeout=30)
        self.assertFalse(app.exception)
        return app

    def send(self, app, store, message):
        with patch('sessions.default_store', return_value=store), patch('config.validate_supabase'), \
             patch('supabase.create_client', return_value=MagicMock()), \
             patch('menu_chat.stream_answer', return_value=iter([ChatEvent('text','PHP 35 [1].'),ChatEvent('done',sources=(Passage(1,'Test','test.txt',None,1),))])) as generation:
            app.chat_input[0].set_value(message).run(timeout=30)
        self.assertFalse(app.exception)
        return generation

    def test_two_browser_sessions_remain_isolated(self):
        store=MemorySessionStore()
        a=self.open(store,'a'*32); b=self.open(store,'b'*32)
        self.send(a,store,'Barangay clearance')
        self.send(b,store,'Business permit')
        self.send(a,store,'magkano?')
        self.assertEqual(a.session_state.menu_state.selected_topic_id,'clearance')
        self.assertEqual(b.session_state.menu_state.selected_topic_id,'business_permit')

    def test_sqlite_ui_restores_topic_after_new_app_and_store(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'sessions.sqlite3'
            first=SQLiteSessionStore(path)
            app=self.open(first,'c'*32)
            self.send(app,first,'Barangay clearance')
            restarted=SQLiteSessionStore(path)
            fresh=self.open(restarted,'c'*32)
            self.assertEqual(fresh.session_state.menu_state.selected_topic_id,'clearance')
            generation=self.send(fresh,restarted,'magkano?')
            self.assertIn('clearance',generation.call_args.args[0].lower())
            self.assertEqual(fresh.session_state.menu_state.selected_detail,'fee')

    def test_timeout_clears_old_transcript_and_starts_greeting(self):
        now=[1000.0];store=MemorySessionStore(clock=lambda:now[0])
        app=self.open(store,'d'*32)
        self.send(app,store,'Barangay clearance')
        old_generation=app.session_state.menu_state.generation_id
        now[0]+=1801
        self.send(app,store,'hello')
        self.assertNotEqual(old_generation,app.session_state.menu_state.generation_id)
        self.assertIsNone(app.session_state.menu_state.selected_topic_id)
        self.assertIn('Kumusta!',app.session_state.messages[0]['content'])

    def test_reset_command_creates_fresh_chat_without_resetting_other_user(self):
        store=MemorySessionStore()
        a=self.open(store,'e'*32);b=self.open(store,'f'*32)
        self.send(a,store,'Barangay clearance');self.send(b,store,'Business permit')
        self.send(a,store,'reset')
        self.assertIsNone(a.session_state.menu_state.selected_topic_id)
        self.assertEqual(store.load('f'*32).selected_topic_id,'business_permit')
        self.assertEqual(a.session_state.menu_state.history,[])
        self.assertEqual(len(a.session_state.messages),1)


if __name__=='__main__':unittest.main()
