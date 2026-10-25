"""One live RAG check, code-only benchmarks, and a forced-failure demo."""
import json
import statistics
import time
from unittest.mock import patch

from ollama import Client
from supabase import create_client
import config
from chat import Passage, stream_passages
from conversation import stream_conversation
from guide_schema import GuideStep, validate_guide, CAUTION


class MeasuredModels:
    def __init__(self):
        self.base = Client(host=config.OLLAMA_HOST, timeout=180)
        self.calls = []

    def embed(self, **kwargs):
        return self.base.embed(**kwargs)

    def chat(self, **kwargs):
        kind = 'generation' if isinstance(kwargs.get('format'), dict) else 'routing_or_topic'
        if kwargs.get('stream'):
            def iterator():
                started = time.perf_counter()
                try:
                    yield from self.base.chat(**kwargs)
                finally:
                    self.calls.append({'kind': kind, 'ms': round((time.perf_counter()-started)*1000, 3)})
            return iterator()
        started = time.perf_counter()
        result = self.base.chat(**kwargs)
        self.calls.append({'kind': kind, 'ms': round((time.perf_counter()-started)*1000, 3)})
        return result


def main():
    config.validate_supabase()
    models = MeasuredModels()
    database = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
    validation = []

    def measured(steps):
        started = time.perf_counter()
        errors = validate_guide(steps)
        validation.append({'ms': round((time.perf_counter()-started)*1000, 3), 'errors': errors})
        return errors

    question = 'Paano kumuha ng clearance sa fictional Halimbawa? Step-by-step please.'
    print('LIVE: ' + question, flush=True)
    started = time.perf_counter()
    answer, sources = '', []
    with patch('chat.validate_guide', side_effect=measured):
        for event in stream_conversation(question, database, models):
            answer += event.text
            if event.kind == 'done':
                sources = [{'source': p.source, 'page': p.page} for p in event.sources]
    live = {'answer': answer, 'sources': sources, 'total_ms': round((time.perf_counter()-started)*1000, 3),
            'llm_calls': models.calls, 'validation': validation, 'validation_llm_calls': 0}
    print(json.dumps(live, ensure_ascii=True), flush=True)

    invalid = json.dumps({'kind': 'guide', 'language': 'english', 'overview': 'Forced test only; not real policy [1].',
        'steps': [{'step_number': 1, 'prerequisite': 'Step 2', 'action': 'Pay [1].'},
                  {'step_number': 2, 'prerequisite': None, 'action': 'Validate [1].'}],
        'answer': '', 'related_topics': [], 'source_ids': ['1'], 'conflicts': []})
    with patch('chat._draft_answer', return_value=invalid) as generate:
        demo = ''.join(e.text for e in stream_passages('Forced test',
            (Passage(1, 'Forced test only.', 'test-fixture.txt', None, 1),), object()))
    assert generate.call_count == 2 and CAUTION['english'] in demo
    print('FORCED FAILURE: ' + demo, flush=True)

    steps = [GuideStep(step_number=i, prerequisite=None if i == 1 else f'Step {i-1}', action=f'Action {i}') for i in range(1, 31)]
    samples = []
    for _ in range(1000):
        started = time.perf_counter()
        assert not validate_guide(steps)
        samples.append((time.perf_counter()-started)*1000)
    benchmark = {'mean_ms': statistics.mean(samples), 'p95_ms': sorted(samples)[949],
                 'max_ms': max(samples), 'runs': 1000, 'steps': 30}
    report = {'live': live, 'forced_failure': {'answer': demo, 'attempts': 2, 'validation_llm_calls': 0},
              'code_benchmark': benchmark,
              'baseline_note': 'The removed legacy audit had no timing logs. No legacy audit call was made for comparison.'}
    output = config.ROOT / '.private' / 'deterministic_guide_final.json'
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print('BENCHMARK: ' + json.dumps(benchmark), flush=True)
    assert answer and sources and validation and all(v['ms'] < 50 for v in validation)
    assert 1 <= sum(c['kind'] == 'generation' for c in models.calls) <= 2
    print('PASS: live guide, deterministic validation, bounded retry and caution demo.', flush=True)


if __name__ == '__main__':
    raise SystemExit(main())
