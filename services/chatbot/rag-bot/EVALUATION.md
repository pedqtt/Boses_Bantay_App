# Phase 6 baseline results

Measured on 24 October 2026, Singapore time.

- Corpus: 3 sample/synthetic documents, 7 chunks.
- Settings unchanged: nomic-embed-text (768 dimensions), TOP_K 5, minimum similarity 0.3, chunk size 1500, overlap 200.
- Original English baseline: 18/18 source/page hits and 18/18 evidence-passage hits.
- Balanced multilingual baseline: 6 English, 6 Tagalog and 6 Taglish supported questions, each language covering the same intents and evidence.
- English: 100% source/page hits; 100% evidence-passage hits (6 questions).
- Tagalog: 100% source/page hits; 100% evidence-passage hits (6 questions).
- Taglish: 100% source/page hits; 100% evidence-passage hits (6 questions).
- Supported retrieval failures: none. Technical failures: none.
- Two unanswerable multilingual diagnostics each retrieved 5 above-threshold passages. Retrieval similarity alone does not establish answerability. These checks are not scored as successful refusals.
- Automated tests: 29 passed.

The 80% retrieval target was met independently for all three languages, so no Phase 7 parameter tuning was performed. This small, author-created test set is not a held-out benchmark; TOP_K 5 against 7 total chunks makes retrieval easier. No claim of production-scale performance, comprehensive bilingual understanding or generated-answer correctness is supported by these scores. Expand the approved corpus, add unseen topics, test spelling variations and assess refusal/grounding accuracy separately.

Detailed reports are saved under ignored .private. Reproduce the multilingual run with `.\.venv\Scripts\python.exe eval.py --output .private/eval_multilingual.json`. Both sets are reusable JSON files; only their expected source/evidence entries depend on the current fixtures. No question-specific answers or keyword rules were added to the chatbot.

## Live language-generation checks

These checks are separate from the retrieval scores above. The Tagalog deposit question retrieved the correct passage at rank 2 but qwen2.5:7b returned the unknown fallback. Additional cross-language and equivalent Tagalog system instructions did not fix that specific false refusal. This is a known answer-generation failure, not missing document content or a retrieval failure. The Taglish equipment question returned the documented 30 chairs and 4 tables with a valid page-2 citation, but unnecessarily repeated the question. The current prompt requests direct answers in the resident's language and preserves source facts, but equal generation quality across languages is not established. Do not describe the 100% retrieval scores as 100% chatbot answer accuracy.

## qwen3:8b upgrade smoke checks

The user selected qwen3:8b with think=False after Phase 6. Live checks returned the documented PHP 200 deposit in English (34.54 seconds including initial load) and Tagalog (13.64 seconds), 30 chairs and four tables in Taglish (14.30 seconds), and the exact unknown fallback for an undocumented Wi-Fi password (13.91 seconds). Supported answers cited the correct synthetic PDF pages. The earlier Tagalog false refusal did not recur in this check. The initial smoke checker rejected the word four because it only matched the digit 4; its test-only numeric matcher now accepts equivalent English/Tagalog words. Model responses were not altered. All four observed outputs passed the corrected fact/citation checks. These four smoke checks do not establish broad accuracy or equal performance across languages. The 30 automated tests passed, and the local Streamlit page renders with qwen3:8b selected.
