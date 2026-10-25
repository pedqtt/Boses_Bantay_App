"""Measure retrieval only. No generation calls or database writes."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys

from ollama import Client
from supabase import create_client
import config
from chat import retrieve, ChatFailure


def normalize(text):
    return re.sub(r'\s+', ' ', text).strip().casefold()


def score_case(case, passages):
    """Each expected source must appear; evidence hit also needs the exact known fact."""
    expected = case.get('expected', [])
    source_hits = []
    evidence_hits = []
    for target in expected:
        matched = [p for p in passages if p.source == target['source']
                   and (target.get('page') is None or p.page == target['page'])]
        source_hits.append(bool(matched))
        evidence_hits.append(any(normalize(target['evidence']) in normalize(p.content) for p in matched))
    return {'source_hit': bool(expected) and all(source_hits),
            'evidence_hit': bool(expected) and all(evidence_hits)}


def run(cases, database, models, top_k, threshold):
    results = []
    for case in cases:
        print(f"Running {case['id']}: {case['question']}", flush=True)
        result = {'id': case['id'], 'question': case['question'],
                  'kind': case['kind'], 'language': case.get('language', 'unspecified'), 'expected': case.get('expected', []), 'error': None}
        try:
            passages = retrieve(case['question'], database, models, top_k, threshold)
            result.update(score_case(case, passages))
            # No document text or credentials in the saved report.
            result['retrieved'] = [{'source': p.source, 'page': p.page,
                                    'similarity': round(p.similarity, 6)} for p in passages]
        except (ChatFailure, ValueError) as error:
            result.update(source_hit=False, evidence_hit=False, retrieved=[], error=str(error))
        results.append(result)
    supported = [r for r in results if r['kind'] == 'supported']
    summary = {'supported_questions': len(supported),
               'source_hits': sum(r['source_hit'] for r in supported),
               'evidence_hits': sum(r['evidence_hit'] for r in supported),
               'technical_failures': sum(r['error'] is not None for r in results)}
    summary['source_hit_rate'] = summary['source_hits'] / len(supported) if supported else 0
    summary['evidence_hit_rate'] = summary['evidence_hits'] / len(supported) if supported else 0
    languages = {}
    for language in sorted({r['language'] for r in supported}):
        group = [r for r in supported if r['language'] == language]
        languages[language] = {'questions': len(group),
                               'source_hit_rate': sum(r['source_hit'] for r in group) / len(group),
                               'evidence_hit_rate': sum(r['evidence_hit'] for r in group) / len(group)}
    summary['languages'] = languages
    return {'timestamp_utc': datetime.now(timezone.utc).isoformat(),
            'settings': {'top_k': top_k, 'threshold': threshold,
                         'embedding_model': config.EMBED_MODEL,
                         'chunk_size': config.CHUNK_SIZE, 'chunk_overlap': config.CHUNK_OVERLAP},
            'summary': summary, 'results': results}


def load_cases(path):
    cases = json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(cases, list) or not cases:
        raise ValueError('Test set must be a non-empty JSON list.')
    seen = set()
    for case in cases:
        if not isinstance(case, dict) or not isinstance(case.get('id'), str) or case['id'] in seen:
            raise ValueError('Each case needs a unique string id.')
        seen.add(case['id'])
        if not isinstance(case.get('question'), str) or not case['question'].strip():
            raise ValueError('Each case needs a question.')
        if case.get('kind') not in {'supported', 'unanswerable'}:
            raise ValueError('Case kind must be supported or unanswerable.')
        expected = case.get('expected', [])
        if not isinstance(expected, list) or (case['kind'] == 'supported' and not expected):
            raise ValueError('Supported cases need expected source/evidence targets.')
        for target in expected:
            if not isinstance(target.get('source'), str) or not isinstance(target.get('evidence'), str) or not target['evidence'].strip():
                raise ValueError('Expected targets need a source filename and evidence text.')
    if not any(c['kind'] == 'supported' for c in cases):
        raise ValueError('At least one supported question is required.')
    return cases


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cases', type=Path, default=config.ROOT / 'eval_questions.json')
    parser.add_argument('--output', type=Path, default=config.ROOT / '.private' / 'eval_baseline.json')
    parser.add_argument('--top-k', type=int, default=config.TOP_K)
    parser.add_argument('--threshold', type=float, default=config.SIMILARITY_THRESHOLD)
    args = parser.parse_args()
    try:
        cases = load_cases(args.cases)
        config.validate_supabase()
        database = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
        models = Client(host=config.OLLAMA_HOST, timeout=180)
        corpus_count = database.table(config.DOCUMENTS_TABLE).select('id', count='exact', head=True).execute().count
        report = run(cases, database, models, args.top_k, args.threshold)
        report['corpus_chunk_count'] = corpus_count
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    except Exception as error:
        print(f'Evaluation setup/report failed ({type(error).__name__}). Check configuration, test set and services. No key details printed.')
        return 1
    summary = report['summary']
    print(f"\nSource/page hit rate @{args.top_k}: {summary['source_hits']}/{summary['supported_questions']} = {summary['source_hit_rate']:.1%}")
    print(f"Evidence-bearing passage hit rate: {summary['evidence_hits']}/{summary['supported_questions']} = {summary['evidence_hit_rate']:.1%}")
    print(f"Corpus: {corpus_count} chunks. Technical failures: {summary['technical_failures']}.")
    for language, metrics in summary['languages'].items():
        print(f"{language}: source hits {metrics['source_hit_rate']:.1%}, evidence hits {metrics['evidence_hit_rate']:.1%} across {metrics['questions']} questions")
    failures = [r for r in report['results'] if r['kind'] == 'supported' and not r['evidence_hit']]
    print('\nFailures:' if failures else '\nNo supported retrieval failures.')
    for result in failures:
        print(json.dumps(result, ensure_ascii=True))
    print('\nUnanswerable retrieval diagnostics (not answer correctness):')
    for result in report['results']:
        if result['kind'] == 'unanswerable':
            print(f"{result['id']}: {len(result['retrieved'])} passages passed the threshold; error={result['error']}")
    print(f'Report saved to {args.output}')
    print('This measures retrieval on the current sample corpus, not generated-answer accuracy or scale readiness.')
    return 0 if all(m['evidence_hit_rate'] >= .8 for m in summary['languages'].values()) and not summary['technical_failures'] else 1


if __name__ == '__main__':
    sys.exit(main())
