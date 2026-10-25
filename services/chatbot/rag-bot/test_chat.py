import unittest
import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from chat import retrieve, stream_answer, ChatFailure, UNKNOWN


def payload(answer='The fictional fee is PHP 200 [1].', kind='answer', steps=None, language='english'):
    return json.dumps({'kind': kind, 'language': language, 'overview': '', 'steps': steps or [],
                       'answer': answer, 'related_topics': [], 'source_ids': ['chunk-1'], 'conflicts': []})


def clients(rows, answer='The fictional fee is PHP 200 [1].'):
    answer = payload(answer, kind='missing_information' if answer.startswith(UNKNOWN) else 'answer')
    db = MagicMock()
    db.rpc.return_value.execute.return_value = SimpleNamespace(data=rows)
    models = MagicMock()
    models.embed.return_value = SimpleNamespace(embeddings=[[1.0] + [0.0] * 767])
    models.chat.return_value = iter([
        SimpleNamespace(message=SimpleNamespace(content=answer), done=False),
        SimpleNamespace(message=SimpleNamespace(content=''), done=True, done_reason='stop')])
    return db, models


def row(score=.8):
    return {'id': 1, 'content': 'Fictional hall deposit is PHP 200.',
            'metadata': {'source': 'guide.pdf', 'page': 2, 'embedding_model': 'nomic-embed-text'},
            'similarity': score}


class ChatTests(unittest.TestCase):
    def setUp(self):
        # Existing tests exercise the embedding fallback. Keyword path has its own tests.
        self.keyword = patch('chat.keyword_rows', return_value=[]).start()
        self.addCleanup(patch.stopall)

    def test_search_prefix_rpc_and_source_metadata(self):
        db, models = clients([row()])
        result = retrieve('What is the deposit?', db, models)
        self.assertEqual(result[0].page, 2)
        self.assertEqual(result[0].source, 'guide.pdf')
        self.assertTrue(models.embed.call_args.kwargs['input'].startswith('search_query: '))
        self.assertEqual(db.rpc.call_args.args[0], 'match_rag_documents')

    def test_no_matches_does_not_call_generator(self):
        for rows in [[], [row(.1)]]:
            db, models = clients(rows)
            events = list(stream_answer('Unrelated question', db, models))
            self.assertEqual(events[0].text, UNKNOWN)
            self.assertEqual(events[-1].sources, ())
            models.chat.assert_not_called()

    def test_streamed_answer_has_cited_passages(self):
        db, models = clients([row()])
        events = list(stream_answer('What is the deposit?', db, models))
        self.assertIn('PHP 200', ''.join(event.text for event in events))
        self.assertEqual(len(events[-1].sources), 1)
        self.assertTrue(models.chat.call_args.kwargs['stream'])
        self.assertEqual(models.chat.call_args.kwargs['model'], 'qwen3:8b')
        self.assertIs(models.chat.call_args.kwargs['think'], False)

    def test_invalid_guide_is_repaired_before_any_text_is_displayed(self):
        db, models = clients([row()])
        wrong = payload('', 'guide', [{'step_number':1,'prerequisite':'Prior action [1].','action':'Dependent action [1].'}, {'step_number':2,'prerequisite':None,'action':'Prior action [1].'}])
        correct = payload('', 'guide', [{'step_number':1,'prerequisite':None,'action':'Prior action [1].'}, {'step_number':2,'prerequisite':'Prior action [1].','action':'Dependent action [1].'}])
        with patch('chat._draft_answer', side_effect=[wrong, correct]) as generate:
            events = list(stream_answer('How do I apply?', db, models))
        self.assertEqual(generate.call_count, 2)
        self.assertIn('first appears in step 2', generate.call_args.args[3]['validation_errors'][0])
        self.assertEqual(len(events[-1].sources), 1)
        self.assertNotIn("couldn't fully verify", ''.join(e.text for e in events))

    def test_twice_rejected_guide_is_shown_with_caution(self):
        db, models = clients([row()])
        wrong = payload('', 'guide', [{'step_number':1,'prerequisite':'Later [1].','action':'First [1].'}, {'step_number':2,'prerequisite':None,'action':'Later [1].'}])
        with patch('chat._draft_answer', return_value=wrong) as generate:
            events = list(stream_answer('How?', db, models))
        self.assertEqual(generate.call_count, 2)
        self.assertIn("I couldn't fully verify the step order, so please double-check it.", ''.join(e.text for e in events))
        self.assertEqual(len(events[-1].sources), 1)

    def test_malformed_response_is_friendly_and_not_blank(self):
        db, models = clients([row()])
        with patch('chat._draft_answer', return_value='not JSON') as generate:
            events = list(stream_answer('How?', db, models))
        self.assertEqual(generate.call_count, 1)
        self.assertIn("couldn't prepare", ''.join(e.text for e in events))
        self.assertNotIn('Traceback', ''.join(e.text for e in events))

    def test_valid_guide_has_no_audit_and_no_retry(self):
        db, models = clients([row()])
        valid = payload('', 'guide', [{'step_number':1,'prerequisite':None,'action':'Prepare [1].'}, {'step_number':2,'prerequisite':'Prepare [1].','action':'Submit [1].'}])
        models.chat.return_value = iter([SimpleNamespace(message=SimpleNamespace(content=valid),done=False), SimpleNamespace(message=SimpleNamespace(content=''),done=True,done_reason='stop')])
        events = list(stream_answer('How?', db, models))
        self.assertEqual(models.chat.call_count, 1)
        self.assertTrue(models.chat.call_args.kwargs['stream'])
        self.assertIsInstance(models.chat.call_args.kwargs['format'], dict)
        self.assertEqual(len(events[-1].sources), 1)

    def test_invalid_step_types_are_schema_errors_not_order_checks(self):
        db, models = clients([row()])
        invalid = payload('', 'guide', [{'step_number':'1','prerequisite':None,'action':'Prepare [1].'}])
        with patch('chat._draft_answer', return_value=invalid), patch('chat.validate_guide') as validate:
            events = list(stream_answer('How?', db, models))
        validate.assert_not_called()
        self.assertTrue(events[0].text)

    def test_model_thinking_field_is_never_rendered(self):
        db, models = clients([row()])
        models.chat.return_value = iter([
            SimpleNamespace(message=SimpleNamespace(content='', thinking='private reasoning'), done=False),
            SimpleNamespace(message=SimpleNamespace(content=payload('PHP 200 [1].'), thinking=None), done=False),
            SimpleNamespace(message=SimpleNamespace(content='', thinking=None), done=True, done_reason='stop')])
        events = list(stream_answer('What is the deposit?', db, models))
        self.assertNotIn('private reasoning', ''.join(event.text for event in events))
        self.assertEqual(len(events[-1].sources), 1)

    def test_retrieved_but_unsupported_returns_unknown_without_sources(self):
        db, models = clients([row()], UNKNOWN)
        events = list(stream_answer('What is the hotline?', db, models))
        self.assertEqual(events[0].text, UNKNOWN)
        self.assertEqual(events[-1].sources, ())

    def test_unknown_elaboration_is_normalized_not_a_technical_failure(self):
        db, models = clients([row()], UNKNOWN + ' The records do not specify a password.')
        events = list(stream_answer('What is the password?', db, models))
        self.assertEqual(''.join(e.text for e in events), UNKNOWN)
        self.assertEqual(events[-1].sources, ())

    def test_technical_errors_are_not_missing_content(self):
        db, models = clients([row()])
        db.rpc.side_effect = RuntimeError('secret payload')
        with self.assertRaises(ChatFailure) as caught:
            list(stream_answer('Question', db, models))
        self.assertNotIn('secret payload', str(caught.exception))
        self.assertIn('lookup failed', str(caught.exception))

    def test_invalid_vector_and_records_fail_closed(self):
        db, models = clients([row()])
        models.embed.return_value.embeddings = [[float('nan')] * 768]
        with self.assertRaises(ChatFailure):
            retrieve('Question', db, models)
        db.rpc.assert_not_called()
        db, models = clients([row(float('nan'))])
        with self.assertRaises(ChatFailure):
            retrieve('Question', db, models)

    def test_missing_or_invented_citations_are_unverified(self):
        for answer in ['PHP 200.', 'PHP 200 [99].']:
            db, models = clients([row()], answer)
            from citations import UNVERIFIED
            with patch('chat._draft_answer', return_value=payload(answer)) as generate:
                events = list(stream_answer('Question', db, models, language='english'))
            self.assertEqual(generate.call_count, 2)
            self.assertEqual(events[0].text, UNVERIFIED['english'])
            self.assertEqual(events[-1].sources, ())

    def test_interrupted_generation_is_not_success(self):
        db, models = clients([row()])
        models.chat.return_value = iter([SimpleNamespace(message=SimpleNamespace(content='Partial [1]'), done=False)])
        with self.assertRaisesRegex(ChatFailure, 'did not finish'):
            list(stream_answer('Question', db, models))


if __name__ == '__main__':
    unittest.main()
