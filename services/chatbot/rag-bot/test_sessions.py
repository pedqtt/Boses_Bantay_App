from copy import deepcopy
import json
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest
from unittest.mock import MagicMock, patch

from chat import ChatEvent, Passage
from menu_flow import ChatState, handle_message
from session_chat import stream_session_message
from sessions import MemorySessionStore, SQLiteSessionStore, SessionConflict, encode


class SessionTests(unittest.TestCase):
    def turn(self, store, session_id, text):
        def answer(query, *args, **kwargs):
            text = 'PHP 35 [1].' if 'fee' in query.casefold() or 'bayad' in query.casefold() else 'Documented topic overview [1].'
            return iter([ChatEvent('text',text),ChatEvent('done',sources=(Passage(1,'Test document','test.txt',None,1),))])
        with patch('menu_chat.stream_answer',side_effect=answer) as generation:
            events=list(stream_session_message(text,session_id,store,database=MagicMock(),models=MagicMock()))
        return ''.join(e.text for e in events), generation

    def test_named_topic_followed_by_fee_keeps_topic(self):
        store=MemorySessionStore()
        self.turn(store,'chat-a','Barangay clearance')
        text, generation=self.turn(store,'chat-a','magkano?')
        state=store.load('chat-a')
        self.assertIn('35',text)
        self.assertEqual(state.selected_topic_id,'clearance')
        self.assertEqual(state.last_answer_topic_id,'clearance')
        self.assertEqual(state.selected_detail,'fee')
        self.assertIn('clearance',generation.call_args.args[0].lower())
        self.assertTrue(generation.call_args.kwargs['session_context']['recent_turns'])
        self.assertEqual(generation.call_count,1)

    def test_short_followups_reuse_topic_and_details_without_new_routing_call(self):
        store=MemorySessionStore()
        self.turn(store,'chat-a','Barangay clearance')
        for message in ['ano requirements?','paano?','yan','yun','ok','sige','yung isa']:
            _,generation=self.turn(store,'chat-a',message)
            self.assertEqual(store.load('chat-a').selected_topic_id,'clearance')
            self.assertEqual(generation.call_count,1)
        self.assertEqual(store.load('chat-a').selected_detail,'steps')

    def test_numbers_back_and_menu_use_stored_step(self):
        store=MemorySessionStore()
        self.turn(store,'chat-a','1')
        self.assertEqual(store.load('chat-a').selected_category_id,'certificates')
        self.turn(store,'chat-a','1')
        self.assertEqual(store.load('chat-a').selected_topic_id,'clearance')
        self.turn(store,'chat-a','Back')
        self.assertEqual(store.load('chat-a').current_step,'topics')
        self.turn(store,'chat-a','Menu')
        state=store.load('chat-a')
        self.assertIsNone(state.selected_category_id); self.assertIsNone(state.selected_topic_id)

    def test_clear_subject_change_overrides_previous_fee_context(self):
        store=MemorySessionStore()
        self.turn(store,'chat-a','Barangay clearance')
        self.turn(store,'chat-a','magkano?')
        self.turn(store,'chat-a','curfew')
        state=store.load('chat-a')
        self.assertEqual(state.selected_topic_id,'curfew')
        self.assertEqual(state.selected_category_id,'complaints')
        self.assertIsNone(state.selected_detail)

    def test_language_persists_for_short_labels_and_switches_for_questions(self):
        store=MemorySessionStore()
        self.turn(store,'chat-a','Magkano ang barangay clearance?')
        self.assertEqual(store.load('chat-a').language,'tagalog')
        self.turn(store,'chat-a','requirements')
        self.assertEqual(store.load('chat-a').language,'tagalog')
        self.turn(store,'chat-a','How much?')
        self.assertEqual(store.load('chat-a').language,'english')
        self.turn(store,'chat-a','Magkano ang fee?')
        self.assertEqual(store.load('chat-a').language,'taglish')

    def test_expired_session_restarts_with_greeting_and_drops_old_data(self):
        now=[1000.0]; store=MemorySessionStore(clock=lambda:now[0])
        self.turn(store,'chat-a','Barangay clearance')
        generation=store.load('chat-a').generation_id
        now[0]+=1801
        text,_=self.turn(store,'chat-a','hello')
        state=store.load('chat-a')
        self.assertIn('Kumusta!',text)
        self.assertNotEqual(state.generation_id,generation)
        self.assertIsNone(state.selected_topic_id)
        self.assertEqual(len(state.history),1)

    def test_two_ids_never_share_state_and_history_is_bounded(self):
        store=MemorySessionStore()
        self.turn(store,'a','Barangay clearance')
        self.turn(store,'b','Business permit')
        for _ in range(10):self.turn(store,'a','magkano?')
        self.assertEqual(store.load('a').selected_topic_id,'clearance')
        self.assertEqual(store.load('b').selected_topic_id,'business_permit')
        self.assertEqual(len(store.load('a').history),8)
        self.assertEqual(len(store.load('b').history),1)

    def test_reset_starts_new_generation_without_retaining_history(self):
        store=MemorySessionStore()
        self.turn(store,'a','Barangay clearance')
        previous=store.load('a').generation_id
        text,_=self.turn(store,'a','new chat')
        state=store.load('a')
        self.assertIn('Kumusta!',text)
        self.assertEqual(state.history,[])
        self.assertNotEqual(previous,state.generation_id)

    def test_payload_never_stores_raw_private_fields_or_cached_answer(self):
        store=MemorySessionStore(); state=store.load('a')
        private='Alice Example lives at 123 Secret Street, ID AB123456789'
        state.last_answer=private
        state.history=[{'user_message':private,'bot_reply':private,'name':'Alice Example','address':'123 Secret Street',
                        'category_id':'certificates','topic_id':'clearance','detail_id':'fee'}]
        state.trail=[{'current_step':'answer','selected_category':'certificates','selected_topic':'clearance','last_answer':private}]
        store.save(state)
        payload=json.dumps(store.sessions)
        for text in ['Alice Example','Secret Street','AB123456789','last_answer":']:
            self.assertNotIn(text,payload)
        self.assertIn('clearance',payload)

    def test_personal_redaction_preserves_general_service_questions(self):
        from session_chat import redact_personal_text
        self.assertEqual(redact_personal_text('What ID requirements apply?'),'What ID requirements apply?')
        self.assertEqual(redact_personal_text('What is the address of the Barangay Hall?'),'What is the address of the Barangay Hall?')
        text=redact_personal_text('My name is Alice Example. Clearance fee? ID: AB123456789; email alice@example.test')
        for value in ['Alice Example','AB123456789','alice@example.test']:
            self.assertNotIn(value,text)

    def test_sqlite_navigation_survives_two_actual_python_processes(self):
        module_dir=str(Path(__file__).resolve().parent)
        first="import sys;sys.path.insert(0,sys.argv[2]);from sessions import SQLiteSessionStore;from menu_flow import handle_message;s=SQLiteSessionStore(sys.argv[1]);x=s.load('opaque-chat');handle_message('1',x);handle_message('1',x);s.save(x);print('saved')"
        second="import sys;sys.path.insert(0,sys.argv[2]);from sessions import SQLiteSessionStore;from menu_flow import handle_message;s=SQLiteSessionStore(sys.argv[1]);x=s.load('opaque-chat');assert x.selected_topic_id=='clearance';d=handle_message('magkano?',x);assert 'clearance' in d.query.lower();s.save(x);print('resumed')"
        with tempfile.TemporaryDirectory() as folder:
            path=str(Path(folder)/'sessions.sqlite3')
            for code,expected in [(first,'saved'),(second,'resumed')]:
                result=subprocess.run([sys.executable,'-c',code,path,module_dir],capture_output=True,text=True,timeout=30)
                self.assertEqual(result.returncode,0,result.stderr)
                self.assertIn(expected,result.stdout)

    def test_stale_memory_save_is_rejected(self):
        store=MemorySessionStore(); first=store.load('a'); second=store.load('a')
        store.save(first)
        with self.assertRaises(SessionConflict):store.save(second)

    def test_sqlite_survives_restarting_store_and_expires(self):
        now=[1000.0]
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'sessions.sqlite3'
            first=SQLiteSessionStore(path,clock=lambda:now[0])
            self.turn(first,'a','Barangay clearance')
            restarted=SQLiteSessionStore(path,clock=lambda:now[0])
            state=restarted.load('a')
            self.assertEqual(state.selected_topic_id,'clearance')
            text,_=self.turn(restarted,'a','magkano?')
            self.assertIn('35',text)
            a=restarted.load('a'); b=first.load('a'); restarted.save(a)
            with self.assertRaises(SessionConflict):first.save(b)
            now[0]+=1801
            restarted.purge_expired()
            with restarted.connect() as db:
                self.assertEqual(db.execute('SELECT count(*) FROM chat_sessions').fetchone()[0],0)
            self.assertIsNone(restarted.load('a').selected_topic_id)


if __name__=='__main__':unittest.main()
