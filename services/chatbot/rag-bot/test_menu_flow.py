from copy import deepcopy
from unittest.mock import MagicMock, patch
import unittest

from menu_flow import ChatState, handle_message, load_kb, opening, remember_answer
from menu_chat import stream_menu_answer
from chat import ChatEvent, Passage


class MenuFlowTests(unittest.TestCase):
    def test_first_message_greets_and_shows_all_categories(self):
        state = ChatState()
        result = handle_message('hello', state)
        self.assertEqual(result.kind, 'menu')
        self.assertIn('Kumusta! Ano po ang kailangan ninyo?', result.text)
        for category in load_kb()['categories']:
            self.assertIn(category['name']['english'], result.text)
        self.assertEqual(state.current_step, 'categories')

    def test_number_one_only_shows_certificate_topics_and_one_question(self):
        state = ChatState()
        result = handle_message('1', state)
        self.assertEqual(state.selected_category, 'certificates')
        self.assertEqual(state.current_step, 'topics')
        self.assertIn('Barangay clearance', result.text)
        self.assertNotIn('Business permit', result.text)
        self.assertIn('Ano po ang gusto ninyong malaman tungkol sa Certificates and Clearances?', result.text)
        self.assertEqual(result.text.count('?'), 1)

    def test_topic_selection_calls_document_retrieval_not_a_menu_fact(self):
        state = ChatState(); handle_message('1', state)
        decision = handle_message('1', state)
        self.assertEqual(decision.kind, 'answer')
        self.assertEqual(decision.mode, 'concise')
        source = Passage(1, 'Documented fact', 'guide.txt', None, .8)
        with patch('menu_chat.stream_answer', return_value=iter([ChatEvent('text','Documented answer [1].'),ChatEvent('done',sources=(source,))])) as lookup:
            events = list(stream_menu_answer(decision, state, MagicMock(), MagicMock()))
        lookup.assert_called_once()
        self.assertIn('clearance', lookup.call_args.args[0].lower())
        self.assertIn('Back to categories', events[0].text)
        self.assertEqual(state.current_step, 'answer')

    def test_broad_category_fee_question_asks_which_service(self):
        state=ChatState()
        result=handle_message('What are the business fees?',state)
        self.assertEqual(result.kind,'menu')
        self.assertEqual(state.selected_category,'business')
        self.assertEqual(state.selected_detail,'fee')
        decision=handle_message('1',state)
        self.assertEqual(decision.kind,'answer')
        self.assertIn('Fee',decision.query)

    def test_direct_first_question_skips_menu(self):
        state = ChatState()
        result = handle_message('magkano ang barangay clearance?', state)
        self.assertEqual(result.kind, 'answer')
        self.assertEqual(result.query, 'magkano ang barangay clearance?')
        self.assertEqual(result.mode, 'concise')
        self.assertNotIn('Kumusta', result.text)

    def test_vague_word_shows_two_to_four_choices(self):
        result = handle_message('clearance', ChatState())
        self.assertEqual(result.kind, 'menu')
        import re
        self.assertTrue(2 <= len(re.findall(r'(?m)^\d+\.', result.text)) <= 4)

    def test_category_and_topic_misspellings_work(self):
        state = ChatState()
        handle_message('certifcates', state)
        self.assertEqual(state.selected_category, 'certificates')
        decision = handle_message('barangay clerance', state)
        self.assertEqual(decision.kind, 'answer')
        self.assertEqual(state.selected_topic, 'clearance')

    def test_menu_and_back_from_every_step(self):
        for step in ['categories','topics','detail','answer']:
            state = ChatState(current_step=step, selected_category='certificates', selected_topic='clearance', last_answer='Prior answer', opened=True)
            result = handle_message('Menu', state)
            self.assertEqual(state.current_step, 'categories')
            self.assertIn('Business and Permits', result.text)
            handle_message('Back', state)
            self.assertEqual(state.current_step, step)
        state = ChatState(); handle_message('1', state); handle_message('1', state)
        remember_answer(state, 'Prior supported reply')
        handle_message('Balik', state)
        self.assertEqual(state.current_step, 'topics')
        handle_message('Balik', state)
        self.assertEqual(state.current_step, 'categories')

    def test_unknown_resets_to_categories_with_unsupported_message(self):
        state = ChatState(); handle_message('1', state)
        result = handle_message('quantum computing homework', state)
        self.assertEqual(result.kind, 'menu')
        self.assertIn("don't support", result.text)
        self.assertIn('Community Programs and Events', result.text)
        self.assertEqual(state.current_step, 'categories')

    def test_menus_have_no_model_or_database_calls(self):
        state = ChatState(); database = MagicMock(); models = MagicMock()
        for message in ['hello','1','Menu','Back','quantum homework']:
            decision = handle_message(message, state)
            self.assertEqual(decision.kind, 'menu')
            list(stream_menu_answer(decision, state, database, models))
        self.assertEqual(models.mock_calls, [])
        self.assertEqual(database.mock_calls, [])

    def test_new_kb_categories_and_topics_appear_without_core_edits(self):
        kb = deepcopy(load_kb())
        category = deepcopy(kb['categories'][0]); category['id']='new_category'
        category['name'] = {'english':'New supported navigation','tagalog':'Bagong paksa'}
        category['topics'] = [{'id':'new_topic','name':{'english':'New topic','tagalog':'Bagong paksa'},'aliases':['brand new']}]
        kb['categories'].append(category)
        state = ChatState()
        self.assertIn('New supported navigation', opening(state,kb))
        result = handle_message('7',state,kb)
        self.assertIn('New topic',result.text)

    def test_bilingual_labels_and_commands_match_language(self):
        state = ChatState(language='english')
        result = handle_message('Mga Paksa',state)
        self.assertIn('Mga Sertipiko at Clearance',result.text)
        result = handle_message('Kalusugan',state)
        self.assertEqual(state.language,'tagalog')
        self.assertIn('Mga serbisyong pangkalusugan',result.text)
        state = ChatState()
        result = handle_message('Business and Permits',state)
        self.assertEqual(state.language,'english')
        self.assertIn('Business permit',result.text)

    def test_back_after_direct_first_question_restores_unselected_root(self):
        state=ChatState()
        handle_message('magkano ang barangay clearance?',state)
        handle_message('Back',state)
        self.assertEqual(state.current_step,'categories')
        self.assertIsNone(state.selected_category)
        self.assertIsNone(state.selected_topic)

    def test_detail_options_and_steps_are_explicit(self):
        state = ChatState(); handle_message('1',state); handle_message('1',state)
        fee = handle_message('Fee',state)
        self.assertEqual(fee.kind,'answer'); self.assertEqual(fee.mode,'concise')
        steps = handle_message('Steps',state)
        self.assertEqual(steps.mode,'guide')
        first = handle_message('Paano kumuha ng barangay clearance?',ChatState())
        self.assertEqual(first.mode,'guide')


if __name__ == '__main__':
    unittest.main()
