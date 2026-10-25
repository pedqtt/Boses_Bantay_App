import json
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from unittest.mock import MagicMock, patch
from chat import ChatEvent, Passage
from mobile_api import MobileChat, APIError, BoundedServer, handler_for
from sessions import MemorySessionStore
from guide_schema import FRIENDLY_ERROR

class MobileAPITests(unittest.TestCase):
    def setUp(self):
        self.store=MemorySessionStore()
        self.db=MagicMock(); self.models=MagicMock()
        self.engine=MobileChat(self.store,b'x'*32,self.db,self.models)

    def test_opening_and_categories_do_not_call_models(self):
        session=self.engine.new_session()
        self.assertIn('Kumusta',session['answer'])
        self.assertIn('6.',session['answer'])
        reply=self.engine.reply({'session_id':session['session_id'],'query':'1'})
        self.assertEqual(reply['current_step'],'topics')
        self.assertIn('Barangay clearance',reply['suggestions'])
        self.db.assert_not_called(); self.models.assert_not_called()

    def test_topic_followup_keeps_memory_and_serializes_sources(self):
        token=self.engine.new_session()['session_id']
        def answer(query,*args,**kwargs):
            return iter([ChatEvent('text','Fictional PHP 35 [1].'),ChatEvent('done',sources=(Passage(1,'Fictional source','guide.pdf',2,.9),))])
        with patch('menu_chat.stream_answer',side_effect=answer) as lookup:
            self.engine.reply({'session_id':token,'query':'Barangay clearance'})
            result=self.engine.reply({'session_id':token,'query':'magkano?'})
        self.assertIn('clearance',lookup.call_args.args[0].lower())
        self.assertEqual(result['sources'][0]['documentTitle'],'guide.pdf')
        self.assertEqual(result['sources'][0]['section'],'pahina 2')
        self.assertFalse(result['retryable'])

    def test_new_sessions_are_separate_and_tampering_fails(self):
        first=self.engine.new_session()['session_id']; second=self.engine.new_session()['session_id']
        self.engine.reply({'session_id':first,'query':'1'})
        self.assertIsNone(self.store.load(second).selected_category)
        invalid=first[:-1]+('a' if first[-1]!='a' else 'b')
        with self.assertRaises(APIError): self.engine.reply({'session_id':invalid,'query':'hello'})

    def test_menu_and_back_return_navigation_choices(self):
        token=self.engine.new_session()['session_id']
        self.engine.reply({'session_id':token,'query':'1'})
        result=self.engine.reply({'session_id':token,'query':'Back'})
        self.assertEqual(len(result['suggestions']),6)
        self.engine.reply({'session_id':token,'query':'2'})
        result=self.engine.reply({'session_id':token,'query':'Menu'})
        self.assertEqual(result['current_step'],'categories')

    def test_failure_remains_retryable_not_missing_information(self):
        token=self.engine.new_session()['session_id']
        with patch('menu_chat.stream_answer',side_effect=RuntimeError('private payload')):
            result=self.engine.reply({'session_id':token,'query':'magkano ang barangay clearance?'})
        self.assertTrue(result['retryable']); self.assertEqual(result['status'],'service_failure')
        self.assertNotIn('private payload',result['answer'])

    def test_busy_is_bounded_and_blank_query_rejected(self):
        token=self.engine.new_session()['session_id']
        self.engine.lock.acquire()
        try:
            with self.assertRaises(APIError) as caught:
                self.engine.reply({'session_id':token,'query':'hello'})
            self.assertEqual(caught.exception.status,503)
        finally: self.engine.lock.release()
        with self.assertRaises(APIError): self.engine.reply({'session_id':token,'query':' '})

    def test_http_auth_contract_and_invalid_payloads(self):
        server=BoundedServer(('127.0.0.1',0),handler_for(self.engine,'test-key'))
        thread=threading.Thread(target=server.serve_forever,daemon=True); thread.start()
        base=f'http://127.0.0.1:{server.server_port}'
        def send(path,payload,key='test-key',extra=None):
            req=Request(base+path,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','X-API-Key':key,**(extra or {})})
            with urlopen(req,timeout=5) as response: return json.load(response)
        try:
            session=send('/api/session',{})
            reply=send('/api/chat',{'session_id':session['session_id'],'query':'1'})
            self.assertEqual(reply['current_step'],'topics')
            for path,body,key,extra,code in [('/api/session',{},'bad',None,401),
                    ('/api/chat',[], 'test-key',None,400),('/api/session',{},'test-key',{'Origin':'https://other.test'},403)]:
                with self.assertRaises(HTTPError) as caught: send(path,body,key,extra)
                self.assertEqual(caught.exception.code,code)
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=5)

if __name__=='__main__': unittest.main()
