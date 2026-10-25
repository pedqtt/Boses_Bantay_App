import json
import time
import unittest
from unittest.mock import MagicMock, patch

from pydantic import ValidationError
from guide_schema import GeneratedResponse, GuideStep, validate_guide, CAUTION, FRIENDLY_ERROR
from chat import Passage, stream_passages


def response(kind='guide', language='english', steps=None):
    return json.dumps({'kind': kind, 'language': language, 'overview': '',
                       'steps': steps if steps is not None else ([{'step_number':1, 'prerequisite':None, 'action':'Prepare [1].'}] if kind == 'guide' else []),
                       'answer': '' if kind == 'guide' else 'Documented answer [1].', 'related_topics': [], 'source_ids': ['1'], 'conflicts': []})


class GuideValidationTests(unittest.TestCase):
    def test_sequential_steps_and_literal_prerequisites_pass_in_all_languages(self):
        for first, second in [('Prepare documents', 'Submit'), ('Ihanda ang mga dokumento', 'Ipasa'), ('I-prepare ang documents', 'I-submit')]:
            steps = [GuideStep(step_number=1, prerequisite=None, action=first),
                     GuideStep(step_number=2, prerequisite=first, action=second)]
            self.assertEqual(validate_guide(steps), [])

    def test_explicit_step_references_resolve_to_earlier_actions(self):
        steps = [GuideStep(step_number=1, prerequisite=None, action='Prepare'),
                 GuideStep(step_number=2, prerequisite='Step 1', action='Submit'),
                 GuideStep(step_number=3, prerequisite='Hakbang 2', action='Finish')]
        self.assertEqual(validate_guide(steps), [])
        bad = [GuideStep(step_number=1, prerequisite='Step 2', action='Pay'),
               GuideStep(step_number=2, prerequisite=None, action='Validate')]
        self.assertIn('first appears in step 2', validate_guide(bad)[0])
        self.assertTrue(validate_guide([GuideStep(step_number=1, prerequisite='Step 9', action='Prepare')]))

    def test_later_prerequisite_has_specific_step_numbers(self):
        steps = [GuideStep(step_number=1, prerequisite='Validate', action='Pay'),
                 GuideStep(step_number=2, prerequisite=None, action='Validate')]
        self.assertIn('Step 1 requires "Validate", which first appears in step 2', validate_guide(steps)[0])

    def test_gaps_duplicates_missing_and_self_dependencies(self):
        for numbers in [[1, 1], [1, 3], [2, 3]]:
            with self.subTest(numbers=numbers):
                self.assertTrue(validate_guide([GuideStep(step_number=n, prerequisite=None, action=str(i)) for i,n in enumerate(numbers)]))
        for prerequisite in ['Not listed', 'Pay']:
            self.assertTrue(validate_guide([GuideStep(step_number=1, prerequisite=prerequisite, action='Pay')]))

    def test_schema_rejects_extra_keys_wrong_types_and_markdown_guides(self):
        value = json.loads(response())
        for change in [{'extra': True}, {'steps': [{'step_number': True, 'prerequisite': None, 'action':'Prepare'}]},
                       {'kind':'answer','steps':[],'answer':'1. A hidden guide'}]:
            with self.subTest(change=change), self.assertRaises(ValidationError):
                GeneratedResponse.model_validate_json(json.dumps({**value, **change}), strict=True)

    def test_declared_sources_alone_do_not_license_uncited_claims(self):
        from citations import UNVERIFIED
        for ids in [['1'], ['99']]:
            value=json.loads(response(kind='answer')); value['answer']='Documented fact.'; value['source_ids']=ids
            with patch('chat._draft_answer',return_value=json.dumps(value)) as generate:
                events=list(stream_passages('Fact?',(Passage(1,'Source','a.txt',None,1),),MagicMock(),language='english'))
            self.assertEqual(generate.call_count,2)
            self.assertEqual(events[0].text,UNVERIFIED['english'])
            self.assertFalse(events[-1].sources)

    def test_concise_topic_answers_do_not_display_unsolicited_steps(self):
        with patch('chat._draft_answer',return_value=response()), patch('chat.validate_guide') as validate:
            text=''.join(e.text for e in stream_passages('Topic overview',(Passage(1,'Source','a.txt',None,1),),MagicMock(),response_mode='concise'))
        validate.assert_not_called()
        self.assertNotIn('1. ',text)
        self.assertIn('Prepare',text)

    def test_non_guides_skip_step_validation_and_do_not_retry(self):
        for kind in ['answer', 'refusal', 'missing_information', 'topics']:
            with patch('chat._draft_answer', return_value=response(kind=kind)) as generate, patch('chat.validate_guide') as validate:
                events = list(stream_passages('Question', (Passage(1,'Source','a.txt',None,.8),), MagicMock()))
            self.assertTrue(events[0].text)
            generate.assert_called_once()
            validate.assert_not_called()

    def test_two_failures_keep_guide_with_language_specific_note(self):
        invalid = [{'step_number':1,'prerequisite':'Later [1].','action':'First [1].'},
                   {'step_number':2,'prerequisite':None,'action':'Later [1].'}]
        for language in ['english','tagalog','taglish']:
            with patch('chat._draft_answer', return_value=response(language=language, steps=invalid)) as generate:
                events = list(stream_passages('Question', (Passage(1,'Source','a.txt',None,.8),), MagicMock(), language=language))
            text = ''.join(e.text for e in events)
            self.assertIn(CAUTION[language], text)
            self.assertIn('1. First', text)
            self.assertEqual(generate.call_count, 2)

    def test_malformed_output_and_failed_repair_never_leave_blank_reply(self):
        passages = (Passage(1,'Source','a.txt',None,.8),)
        for language in ['english','tagalog','taglish']:
            with patch('chat._draft_answer', return_value='{"broken":'):
                text = ''.join(e.text for e in stream_passages('Question', passages, MagicMock(), language=language))
            self.assertEqual(text, FRIENDLY_ERROR[language])
        invalid = response(steps=[{'step_number':2,'prerequisite':None,'action':'Prepare [1].'}])
        with patch('chat._draft_answer', side_effect=[invalid, 'broken JSON']):
            text = ''.join(e.text for e in stream_passages('Question', passages, MagicMock()))
        self.assertIn('2. Prepare', text)
        self.assertIn(CAUTION['english'], text)

    def test_validation_under_50ms_without_any_model(self):
        steps = [GuideStep(step_number=i, prerequisite=None if i == 1 else f'Action {i-1}', action=f'Action {i}') for i in range(1,31)]
        started = time.perf_counter()
        for _ in range(100):
            self.assertEqual(validate_guide(steps), [])
        average_ms = (time.perf_counter()-started)*1000/100
        self.assertLess(average_ms, 50)


if __name__ == '__main__':
    unittest.main()
