import unittest
from unittest.mock import patch
from chat import Passage, ChatFailure
from eval import score_case, run, load_cases
from pathlib import Path
from collections import Counter


class EvaluationTests(unittest.TestCase):
    def test_languages_have_equal_intents_and_evidence_targets(self):
        cases = load_cases(Path(__file__).with_name('eval_questions.json'))
        supported = [c for c in cases if c['kind'] == 'supported']
        self.assertEqual(Counter(c['language'] for c in supported), {'english': 6, 'tagalog': 6, 'taglish': 6})
        for intent in {c['intent'] for c in supported}:
            group = [c for c in supported if c['intent'] == intent]
            self.assertEqual(len(group), 3)
            self.assertTrue(all(c['expected'] == group[0]['expected'] for c in group))

    def test_language_scores_are_reported_separately(self):
        expected = [{'source': 'a.txt', 'evidence': 'Alpha'}]
        cases = [{'id': lang, 'kind': 'supported', 'language': lang, 'question': 'Question', 'expected': expected}
                 for lang in ['english', 'tagalog', 'taglish']]
        with patch('eval.retrieve', side_effect=[(Passage(1, 'Alpha', 'a.txt', None, .8),), (), ()]):
            report = run(cases, object(), object(), 5, .3)
        self.assertEqual(report['summary']['languages']['english']['evidence_hit_rate'], 1)
        self.assertEqual(report['summary']['languages']['tagalog']['evidence_hit_rate'], 0)
        self.assertEqual(report['summary']['languages']['taglish']['evidence_hit_rate'], 0)

    def test_correct_page_and_whitespace_normalized_evidence(self):
        case = {"expected": [{"source": "a.pdf", "page": 2, "evidence": "The fee is 20."}]}
        passage = Passage(1, "The\n fee \n is 20.", "a.pdf", 2, .8)
        self.assertEqual(score_case(case, [passage]), {"source_hit": True, "evidence_hit": True})
        wrong_page = Passage(1, passage.content, "a.pdf", 1, .8)
        self.assertFalse(score_case(case, [wrong_page])["source_hit"])

    def test_filename_match_alone_does_not_prove_evidence_hit(self):
        case = {"expected": [{"source": "a.txt", "evidence": "A specific fact"}]}
        result = score_case(case, [Passage(1, "Other topic", "a.txt", None, .8)])
        self.assertTrue(result["source_hit"])
        self.assertFalse(result["evidence_hit"])

    def test_multi_document_case_requires_every_source(self):
        case = {"expected": [{"source": "a.txt", "evidence": "Alpha"}, {"source": "b.txt", "evidence": "Beta"}]}
        self.assertFalse(score_case(case, [Passage(1, "Alpha", "a.txt", None, .8)])["source_hit"])

    def test_technical_failures_count_and_unanswerable_not_in_hit_denominator(self):
        cases = [{"id": "Q1", "kind": "supported", "question": "Question", "expected": [{"source": "a.txt", "evidence": "Alpha"}]},
                 {"id": "U1", "kind": "unanswerable", "question": "Unknown", "expected": []}]
        with patch("eval.retrieve", side_effect=[ChatFailure("Lookup failed"), ()]):
            report = run(cases, object(), object(), 5, .3)
        self.assertEqual(report["summary"]["supported_questions"], 1)
        self.assertEqual(report["summary"]["source_hit_rate"], 0)
        self.assertEqual(report["summary"]["technical_failures"], 1)


if __name__ == "__main__":
    unittest.main()
