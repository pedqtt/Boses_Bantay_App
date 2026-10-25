import json
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from streamlit.testing.v1 import AppTest
from chat import Passage
from guide_schema import CAUTION, FRIENDLY_ERROR


class UIResponseBoundaryTests(unittest.TestCase):
    def run_reply(self, payload, language, guide=False):
        app = AppTest.from_file(str(Path(__file__).with_name('app.py'))).run(timeout=30)
        questions = {'english': 'How do I get barangay clearance?' if guide else 'What is the barangay clearance fee?',
                     'tagalog': 'Paano kumuha ng barangay clearance?' if guide else 'Magkano ang barangay clearance?',
                     'taglish': 'Paano kumuha ng barangay clearance, steps please?' if guide else 'Magkano ang fee ng barangay clearance?'}
        with patch('config.validate_supabase'), patch('supabase.create_client', return_value=MagicMock()), \
             patch('conversation.route_message', return_value=('lookup', language, 'Forced question')), \
             patch('chat.retrieve', return_value=(Passage(1,'Test only','fixture.txt',None,1),)), \
             patch('chat._draft_answer', return_value=payload):
            app.chat_input[0].set_value(questions[language]).run(timeout=30)
        self.assertFalse(app.exception)
        return app.session_state.messages[-1]['content']

    def test_opening_and_category_navigation_never_initialize_services(self):
        with patch('ollama.Client') as model, patch('supabase.create_client') as database, patch('config.validate_supabase') as credentials:
            app = AppTest.from_file(str(Path(__file__).with_name('app.py'))).run(timeout=30)
            self.assertIn('Kumusta!', app.session_state.messages[0]['content'])
            self.assertIn('6. Contact, Hours, and Officials', app.session_state.messages[0]['content'])
            app.chat_input[0].set_value('1').run(timeout=30)
            self.assertFalse(app.exception)
            self.assertEqual(app.session_state.menu_state.selected_category,'certificates')
            self.assertNotIn('Business permit', app.session_state.messages[-1]['content'])
            app.chat_input[0].set_value('Menu').run(timeout=30)
            app.chat_input[0].set_value('Back').run(timeout=30)
            self.assertFalse(app.exception)
            model.assert_not_called(); database.assert_not_called(); credentials.assert_not_called()

    def test_clear_conversation_resets_category_state_and_greeting(self):
        app = AppTest.from_file(str(Path(__file__).with_name('app.py'))).run(timeout=30)
        app.chat_input[0].set_value('1').run(timeout=30)
        app.button[0].click().run(timeout=30)
        self.assertFalse(app.exception)
        self.assertEqual(len(app.session_state.messages),1)
        self.assertIsNone(app.session_state.menu_state.selected_category)
        self.assertIn('Kumusta!',app.session_state.messages[0]['content'])

    def test_forced_order_failure_shows_guide_and_caution(self):
        payload = json.dumps({'kind':'guide','language':'english','overview':'Test only [1]',
            'steps':[{'step_number':1,'prerequisite':'Step 2','action':'Pay [1].'},
                     {'step_number':2,'prerequisite':None,'action':'Validate [1].'}],
            'answer':'','related_topics':[], 'source_ids':['1'], 'conflicts':[]})
        text = self.run_reply(payload, 'english', guide=True)
        self.assertIn('1. Pay', text)
        self.assertIn(CAUTION['english'], text)

    def test_malformed_output_shows_localized_nonblank_reply(self):
        for language in ['english','tagalog','taglish']:
            self.assertIn(FRIENDLY_ERROR[language], self.run_reply('broken JSON', language))

    def test_cited_answer_sources_survive_ui_navigation_footer(self):
        value = {'kind':'answer','language':'english','overview':'','steps':[],
                 'answer':'Test answer [1].','related_topics':[], 'source_ids':['1'],'conflicts':[]}
        for language,heading in [('english','Sources'),('tagalog','Pinagmulan'),('taglish','Sources')]:
            text = self.run_reply(json.dumps(value),language)
            self.assertIn(heading + ':',text)
            self.assertTrue(text.rstrip().endswith('[1] fixture.txt'))

    def test_invalid_citations_are_friendly_in_ui(self):
        from citations import UNVERIFIED
        value = {'kind':'answer','language':'english','overview':'','steps':[],
                 'answer':'Unsupported claim [99].','related_topics':[], 'source_ids':['99'],'conflicts':[]}
        text=self.run_reply(json.dumps(value),'english')
        self.assertIn(UNVERIFIED['english'],text)
        self.assertNotIn('Unsupported claim',text)
        self.assertNotIn('Traceback',text)


if __name__ == '__main__':
    unittest.main()
