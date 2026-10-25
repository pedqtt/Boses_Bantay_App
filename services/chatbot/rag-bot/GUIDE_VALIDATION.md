# Deterministic guide validation

The normal path makes no validation/audit LLM calls. It requests a strict Pydantic-backed JSON-schema response in the answer-generation call. Only kind=guide runs validate_guide. Other response kinds skip the validator.

Each step declares step_number, prerequisite (null, an explicit Step N/Hakbang N reference, or the exact earlier action), and action. Numbering and dependency ordering are checked deterministically. Invalid guides receive one regeneration with specific validation_errors; another failure shows the last guide with a localized caution. Invalid first JSON returns a friendly localized message. A malformed/failed repair preserves the previous guide with its caution.

## Measured live result

Same fictional clearance question, same local qwen3:8b model:

- Full final request: 29.42 seconds, including routing, embedding, lookup and generation.
- routing_or_topic: 12.13 seconds.
- generation: 14.04 seconds.
- Pure-code guide validation: 1.123 ms, 0 errors.
- Benchmark: 1,000 runs of 30 steps; mean 0.132 ms, p95 0.220 ms, maximum 0.993 ms.
- Validation LLM calls: zero. Final live generation attempts: one.
- All 60 automated tests passed, including the UI caution/malformed-output paths in English, Tagalog and Taglish.
- Forced ordering failure produced the guide and: "I couldn't fully verify the step order, so please double-check it." No traceback or blank reply.
- The actual CLI service-failure check returned a friendly Tagalog message without a traceback. Full errors and separate generation/parse/validation timings are written under ignored .private.

The first instrumented no-audit revision took 43.83 seconds and needed two generations because it rejected valid Step N references. Resolving explicit references in code removed that avoidable retry; the final run took 29.42 seconds. These are individual local runs, not a controlled performance study. The earlier removed legacy audit had no latency instrumentation, so its exact before/after timing cannot be reconstructed; no extra legacy LLM audit was run to invent a baseline.

## Limits and reproduction

This validates the declared dependency graph only. It cannot establish semantic equivalence of arbitrary phrases, detect an omitted prerequisite declared as null, or prove a source claim true. Model prompts/citation identifiers are not semantic fact verification. Topic/greeting routing remains probabilistic. Source documents in this check are explicitly fictional test fixtures.

Run from this folder:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -p "test_*.py" -v
.\.venv\Scripts\python.exe verify_guide_validation.py
```

Old tests that expected a second model audit or fatal rejection were updated to the requested no-audit/non-fatal contract. Existing retrieval, ingestion, grounding, model-mode and language tests remain covered. Detailed measurement JSON and runtime logs are ignored by Git.
