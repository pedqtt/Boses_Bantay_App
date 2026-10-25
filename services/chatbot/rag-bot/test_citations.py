import json
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from chat import Passage, ChatFailure, retrieve, stream_answer, stream_passages
from citations import citation_errors, sources_block, UNVERIFIED, CONFLICT
from guide_schema import GeneratedResponse
from ingest import prepare_rows, IngestFailure
from keyword_search import keyword_rows
from menu_flow import ChatState, handle_message
from menu_chat import stream_menu_answer

def draft(answer='The fee is PHP 35 [1].', ids=None, conflicts=None):
    return json.dumps(dict(kind='answer',language='english',overview='',steps=[],answer=answer,
                           related_topics=[],source_ids=ids if ids is not None else ['10'],conflicts=conflicts or []))

def passage(number=1, sid='10', filename='guide.pdf', page=2):
    return Passage(number,'The fee is PHP 35.',filename,page,.9,sid)

def row(active=True):
    return dict(id=10,content='The barangay clearance fee is PHP 35.',metadata=dict(source='guide.pdf',page=2,active=active),similarity=.9)

class CitationTests(unittest.TestCase):
    def test_localized_sources_are_built_from_stored_filenames(self):
        for language,heading,location in [('english','Sources','page'),('tagalog','Pinagmulan','pahina'),('taglish','Sources','page')]:
            with patch('chat._draft_answer',return_value=draft()) as generate:
                events=list(stream_passages('Fee?',(passage(),),MagicMock(),language=language))
            self.assertIn(f'{heading}:\n\n[1] guide.pdf, {location} 2',events[0].text)
            self.assertIn('PHP 35 [1]',events[0].text)
            generate.assert_called_once()
            self.assertEqual(len(events[-1].sources),1)

    def test_txt_has_no_invented_page(self):
        self.assertEqual(sources_block((passage(filename='guide.txt',page=None),)),'Sources:\n\n[1] guide.txt')

    def test_invalid_markers_are_stripped_from_repair_and_never_displayed(self):
        with patch('chat._draft_answer',side_effect=[draft('Wrong [99].',['fake']),draft()]) as generate:
            events=list(stream_passages('Fee?',(passage(),),MagicMock()))
        self.assertEqual(generate.call_count,2)
        feedback=generate.call_args.args[3]
        self.assertNotIn('[99]',feedback['previous_response']['answer'])
        self.assertEqual(feedback['previous_response']['source_ids'],[])
        self.assertTrue(feedback['validation_errors'])
        self.assertNotIn('Wrong',events[0].text)

    def test_two_failures_do_not_show_unsupported_draft(self):
        with patch('chat._draft_answer',return_value=draft('Wrong [99].')) as generate:
            events=list(stream_passages('Fee?',(passage(),),MagicMock(),language='tagalog'))
        self.assertEqual(generate.call_count,2)
        self.assertEqual(events[0].text,UNVERIFIED['tagalog'])
        self.assertFalse(events[-1].sources)

    def test_each_claim_and_declared_id_is_checked(self):
        for text,ids in [('Uncited claim. Fact [1].',['10']),('Fact [1].',[]),('Fact [1].',['fake']),
                         ('Fact [1].\nSources: fake.pdf',['10']),('See https://fake.example [1].',['10'])]:
            self.assertTrue(citation_errors(GeneratedResponse.model_validate_json(draft(text,ids)),(passage(),)))

    def test_conflicting_files_remain_visible(self):
        value=draft('The 2025 text says PHP 35 [1]. The 2026 text says PHP 50 [2].',['10','11'],[['10','11']])
        with patch('chat._draft_answer',return_value=value):
            events=list(stream_passages('Fee?',(passage(),passage(2,'11','new.pdf',3)),MagicMock(),language='english'))
        self.assertIn(CONFLICT['english'],events[0].text)
        self.assertIn('[2] new.pdf, page 3',events[0].text)
        self.assertEqual(len(events[-1].sources),2)
        bad=GeneratedResponse.model_validate_json(draft(conflicts=[['10','fake']]))
        self.assertTrue(citation_errors(bad,(passage(),)))

    def test_no_results_returns_hall_and_categories_without_generation(self):
        state=ChatState(); decision=handle_message('Magkano ang barangay clearance?',state); models=MagicMock()
        with patch('chat.retrieve',return_value=()):
            events=list(stream_menu_answer(decision,state,MagicMock(),models))
        self.assertIn('Barangay Hall',events[0].text)
        self.assertIn('6.',events[0].text)
        self.assertEqual(state.current_step,'categories')
        self.assertIsNone(state.selected_topic)
        models.chat.assert_not_called()

    def test_menus_do_not_have_citations(self):
        state=ChatState(); models=MagicMock()
        for question in ['hello','1','Menu']:
            events=list(stream_menu_answer(handle_message(question,state),state,MagicMock(),models))
            self.assertNotIn('Sources:',events[0].text)
            self.assertNotIn('Pinagmulan:',events[0].text)
        models.chat.assert_not_called()

    def test_exact_stored_answer_skips_generation(self):
        entry=dict(questions=['What is the fee?'],language='english',answer='The fee is PHP 35.')
        p=Passage(1,entry['answer'],'guide.txt',None,.9,'10',(entry,)); models=MagicMock()
        with patch('chat.retrieve',return_value=(p,)):
            events=list(stream_answer('What is the fee?',MagicMock(),models,language='english'))
        models.chat.assert_not_called()
        self.assertIn('PHP 35. [1]',events[0].text)
        with patch('chat.retrieve',return_value=(p,)),patch('chat._draft_answer',return_value=draft()) as generate:
            list(stream_answer('What is the fee?',MagicMock(),models,language='tagalog'))
        generate.assert_called_once()

    def test_ingest_keeps_simple_metadata_and_rejects_invented_stored_answer(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'guide.txt'; path.write_text('The fee is PHP 35.',encoding='utf-8')
            value=prepare_rows(path)[0]['metadata']
            self.assertEqual(value['source'],'guide.txt'); self.assertTrue(value['active'])
            answer=dict(questions=['Fee?'],language='english',answer='PHP 999')
            with self.assertRaises(IngestFailure): prepare_rows(path,answers=[answer])

    def test_validation_is_fast(self):
        response=GeneratedResponse.model_validate_json(draft()); started=time.perf_counter()
        for _ in range(100): self.assertEqual(citation_errors(response,(passage(),)),[])
        self.assertLess((time.perf_counter()-started)*1000/100,50)

    def test_uncited_optional_suggestion_is_omitted_without_extra_generation(self):
        value=json.loads(draft()); value['related_topics']=['How do I apply?']
        with patch('chat._draft_answer',return_value=json.dumps(value)) as generate:
            events=list(stream_passages('Fee?',(passage(),),MagicMock()))
        generate.assert_called_once()
        self.assertIn('PHP 35 [1]',events[0].text)
        self.assertNotIn('How do I apply?',events[0].text)

class KeywordTests(unittest.TestCase):
    def database(self,rows):
        db=MagicMock()
        db.table.return_value.select.return_value.or_.return_value.or_.return_value.order.return_value.limit.return_value.execute.return_value=SimpleNamespace(data=rows)
        return db

    def test_keywords_and_small_typo_skip_embeddings(self):
        for question in ['barangay clearance fee','barangay clearence fee']:
            db=self.database([row()]); models=MagicMock()
            self.assertEqual(retrieve(question,db,models)[0].source_id,'chunk-10')
            models.embed.assert_not_called(); db.rpc.assert_not_called()

    def test_no_keyword_hit_falls_back_to_embedding(self):
        db=self.database([]); db.rpc.return_value.execute.return_value=SimpleNamespace(data=[row()])
        models=MagicMock(); models.embed.return_value=SimpleNamespace(embeddings=[[1.0]+[0.0]*767])
        self.assertTrue(retrieve('magkano clearance',db,models)); models.embed.assert_called_once()

    def test_inactive_rows_are_filtered_in_both_paths(self):
        db=self.database([row(False)]); models=MagicMock()
        db.rpc.return_value.execute.return_value=SimpleNamespace(data=[row(False)])
        models.embed.return_value=SimpleNamespace(embeddings=[[1.0]+[0.0]*767])
        self.assertEqual(retrieve('clearance fee',db,models),())

    def test_keyword_failure_is_not_missing_information(self):
        db=MagicMock(); db.table.side_effect=RuntimeError('private SDK output')
        with self.assertRaisesRegex(ChatFailure,'lookup failed'): retrieve('clearance fee',db,MagicMock())

    def test_missing_filename_fails_closed(self):
        value=row(); value['metadata'].pop('source')
        with patch('chat.keyword_rows',return_value=[value]),self.assertRaises(ChatFailure):
            retrieve('clearance fee',MagicMock(),MagicMock())
