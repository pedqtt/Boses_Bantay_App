"""Live smoke checks against the explicitly fictional Phase 4 fixtures."""
import json
import re
from pathlib import Path
import time
from ollama import Client
from supabase import create_client
import config
from chat import stream_answer, UNKNOWN


def main():
    config.validate_supabase()
    database = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
    models = Client(host=config.OLLAMA_HOST, timeout=180)
    cases = [
        ("english", "How much is the reservation deposit for the fictional Barangay Halimbawa hall?", [["200", "two hundred", "dalawang daan"]], "synthetic_facility_guide.pdf", 1),
        ("tagalog", "Magkano ang paunang bayad para maipareserba ang bulwagan sa kathang-isip na Barangay Halimbawa?", [["200", "two hundred", "dalawang daan"]], "synthetic_facility_guide.pdf", 1),
        ("taglish", "Ilang chairs at tables ang included sa fictional Halimbawa hall booking?", [["30", "thirty", "tatlumpu"], ["4", "four", "apat"]], "synthetic_facility_guide.pdf", 2),
        ("unanswerable", "What is the exact Wi-Fi password for the fictional barangay study room?", [], None, None),
    ]
    results = []
    for language, question, numbers, source, page in cases:
        print(f"Testing {language}: {question}", flush=True)
        start = time.monotonic()
        answer = ""
        sources = []
        error = None
        try:
            for event in stream_answer(question, database, models):
                answer += event.text
                if event.kind == "done":
                    sources = [{"source": p.source, "page": p.page} for p in event.sources]
            passed = (answer == UNKNOWN and not sources) if source is None else (
                all(any(re.search(r"\b" + re.escape(form) + r"\b", answer, re.I) for form in variants) for variants in numbers) and
                {"source": source, "page": page} in sources and answer != UNKNOWN)
        except Exception as failure:
            error = type(failure).__name__
            passed = False
        result = {"language": language, "question": question, "answer": answer,
                  "sources": sources, "seconds": round(time.monotonic() - start, 2),
                  "error": error, "passed": passed}
        results.append(result)
        print(json.dumps(result, ensure_ascii=True), flush=True)
    output = config.ROOT / ".private" / "model_smoke.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps({"model": config.CHAT_MODEL, "think": config.CHAT_THINK,
                                  "results": results}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Passed {sum(r['passed'] for r in results)}/{len(results)} checks. Language naturalness requires manual review.")
    return 0 if all(r['passed'] for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
