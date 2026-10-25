# Ollama document RAG chatbot

This separate Python chatbot uses Ollama qwen3:8b, nomic-embed-text (768 dimensions) and the existing Supabase project. It requires the local Ollama host to stay on. The hosted Cloudflare chatbot is unchanged.

Filename/page citations, code-only validation, keyword-first lookup, and the
optional database search index are documented in [CITATIONS.md](CITATIONS.md).

## Phase 2

1. Open the existing Supabase project SQL editor. Run schema.sql once. It creates only rag_documents and match_rag_documents plus their permissions/index. It does not replace documents or the existing search functions. An existing rag_documents table causes a transactional failure instead of overwriting it.
2. Run verify_schema.sql. Expect a PASS notice with similarity 1 and remaining_verification_rows = 0. This is a synthetic vector database test, not a retrieval quality test. The temporary row is rolled back.
3. In project settings, find the project URL under Data API and the legacy service_role key under API Keys. Save them privately in this directory's .env as SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Never use an EXPO_PUBLIC_ prefix or put this key in the mobile app. The service-role key bypasses RLS and is restricted to the trusted local Python backend. No credential is bundled with this folder.
4. Stop here until Phase 2 verification is confirmed. Python dependencies and config.py belong to Phase 3.

No public read policies are installed. Search is SECURITY INVOKER and executable only by service_role. Do not expose the local backend publicly without authentication and a separate access design.

## Phase 3

From this folder, run `.\.venv\Scripts\python.exe verify_connections.py`. The environment is isolated in `.venv` and direct dependency versions are pinned in requirements.txt. To recreate it, run `python -m venv .venv`, then `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`. Store SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the ignored local .env. Do not reuse Expo public variables for this privileged key. A failed check exits nonzero. Do not begin ingestion until both checks print OK.

## Phase 4

Run `.\.venv\Scripts\python.exe ingest.py` from this directory. It reads top-level UTF-8 TXT and text-based PDF files from docs, preserves PDF page numbers, chunks at paragraph/sentence boundaries with up to 1500 characters and 200-character overlap, and embeds with the search_document prefix. All vectors are checked for 768 finite nonzero values. Rows are inserted in batches of 50. File contents and credentials stay out of Git.

Run only one ingestion process at a time. Each successful file replaces rows with its exact source filename. Extraction and all embeddings finish before old rows are deleted. Database replacement is not atomic: a service failure during inserts can leave partial rows; rerun to replace them. Empty/corrupt files preserve old indexed rows and report their status. Removing a source file from docs does not remove its stored rows. Scanned PDFs need external OCR.

`create_demo_docs.py` creates explicitly fictional TXT/PDF fixtures without overwriting files. These must be removed from both docs and rag_documents before using real resident records. They are never real barangay guidance. Run `python -m unittest test_ingest.py -v` for the isolated ingestion tests.

## Reusable document uploader

`upload_documents.py` is UI-independent. `preview_upload(filename, data)` validates PDF/UTF-8 TXT bytes and returns filename, chunk count, readable PDF pages and a text excerpt without database writes. `ingest_upload(filename, data, database, models, docs_dir=None)` saves and indexes one new document using injected Supabase/Ollama clients, returning the inserted chunk count. Import these functions from your later main Python backend. Do not put the service-role key in a mobile or browser frontend.

`upload_app.py` is a small local Streamlit example. From this folder run:

```powershell
.\.venv\Scripts\python.exe -m streamlit run upload_app.py --server.address 127.0.0.1
```

Select a PDF/TXT file, inspect the preview, then click Index document. Files are limited to 20 MB; corrupt, blank or scanned-only files are rejected. Filenames containing paths are rejected. Existing local/indexed filenames are refused rather than overwritten. The upload lock coordinates this helper only; do not run CLI ingestion concurrently. After a crash, remove docs/.upload.lock only after confirming no upload is active.

This is a local admin prototype with no authentication, replacement or deletion UI. Database inserts still use the Phase 4 non-transactional backend: partial database rows can remain after a storage failure and require cleanup before retrying. It does not change the existing mobile chatbot or hosted Worker. Unit tests and Streamlit AppTest cover validation, duplicate rejection, ingestion handoff and initial page rendering; a real interactive upload has not been exercised through the browser.

## Phase 5: document chat

From this folder run:

```powershell
.\.venv\Scripts\python.exe chat.py
```

For one question, use `.\.venv\Scripts\python.exe chat.py --question "How much is the fictional hall reservation deposit?"`. Type exit to finish interactive chat. The uploader remains separate. app.py provides a local chat UI; the conversation layer uses recent messages only to resolve navigation and follow-up references.

The reusable `retrieve(question, database, models)` embeds with search_query, calls match_rag_documents, and filters at SIMILARITY_THRESHOLD (default 0.3 in .env). `stream_answer(...)` yields ChatEvent text events followed by a done event with cited Passage objects, including filename, PDF page and retrieved content. TOP_K defaults to 5 in config.py. No passing passages means the exact unknown response without calling the generation model. When related passages do not answer the question, the model returns structured kind=missing_information, normalized to the same internal unknown marker. Technical errors raise ChatFailure instead of claiming missing content. Consumers must handle ChatFailure as a technical or validation issue; never turn it into a missing-information answer.

Citations are checked for valid passage numbers and omitted for unknown answers. This is a basic RAG pipeline, not a semantic claim verifier: a valid citation number does not prove that every generated claim is entailed. Structured drafts are parsed before display; numbered guides receive code-only dependency/numbering checks, never an LLM audit. Approved text is delivered as UI text events after those checks. Similarity is not answerability, and prompt instructions alone cannot guarantee injection resistance. Synthetic and sample documents are test material, not verified real barangay policy. Phase 6 retrieval results are recorded in EVALUATION.md.

## Interactive Phase 5 test
Run .\.venv\Scripts\python.exe -m streamlit run app.py --server.address 127.0.0.1 --server.port 8502 to test the existing chat pipeline in a browser. Sources expand under each answer. Recent history is used for navigation and follow-up references, never as factual evidence. This is a local testing UI, not a hosted deployment.

## Phase 6: retrieval evaluation

Run `.\.venv\Scripts\python.exe eval.py` from this directory. The test set eval_questions.json gives English, Tagalog and Taglish equal coverage: six matched supported intents per language, including a two-document question, plus two unanswerable retrieval diagnostics. Each translation uses the same expected sources, PDF pages and supporting text. Source/page hits and evidence-bearing passage hits are scored separately by language. Every language must reach at least 80% evidence hits and there must be no technical failures for a successful evaluation exit. Technical errors count as failures.

The original 18-question English baseline is retained in eval_questions_english_baseline.json. Reports go under ignored .private. Override --cases, --output, --top-k and --threshold to reuse the runner on new corpora. The runner makes embedding/search requests only and never writes document rows or calls the answer-generation model. Unanswerable cases are excluded from positive hit-rate denominators: retrieving related passages does not prove that they answer a question. Evaluate refusals separately through chat.

This is an initial test on only seven sample/synthetic chunks, with five results requested. Source hit rates can be optimistic on such a small corpus, especially when several topics share one chunk. Scores do not establish production accuracy, scale readiness, or native-language response quality. The prompt now prioritizes the resident's English, Tagalog or Taglish language, but the specified unknown response remains the exact English sentence. Broader dialects, misspellings, mixed-language ambiguity and held-out documents still need testing.

## Answer model upgrade

On 24 October 2026 the answer model was changed at the user's request from qwen2.5:7b to qwen3:8b. config.py selects the new model and CHAT_THINK=False; the Ollama chat call explicitly sends think=False and renders only message.content. Download with `ollama pull qwen3:8b`. The old model is retained locally as a fallback, but is not selected automatically. nomic-embed-text, 768-dimensional vectors, Supabase schema and stored chunks are unchanged, so no re-ingestion is required. Restart a running Streamlit process after changing config.py to avoid Python's imported-module cache.

Run `.\.venv\Scripts\python.exe verify_model.py` for English, Tagalog, Taglish and unknown-answer smoke checks against the synthetic fixtures. This checks documented values and citation locations, not comprehensive naturalness or semantic grounding. It saves results in ignored .private/model_smoke.json. The initial Phase 6 retrieval scores do not measure the new answer model; previous false-refusal results in EVALUATION.md are historical qwen2.5:7b observations.

## Conversational interactions and topic discovery

`conversation.py` provides the older `stream_conversation(question, database, models, history=None)` integration. The category-first UI/CLI now use menu_flow.py and menu_chat.py (see MENU_FLOW.md); `chat.stream_answer` remains the direct factual RAG entry point used by retrieval/model tests. A structured, non-thinking qwen3:8b router separates social greetings, thanks, goodbyes, document discovery, factual lookups, clarification and unrelated requests. A greeting containing a real question goes to factual retrieval rather than losing the question. Technical routing/catalogue failures remain explicit technical errors.

Greetings and discovery messages load a bounded sample of indexed passages, diversified across filenames. The model selects up to three topic phrases copied from actual passages; code verifies each phrase and its citation before rendering friendly English, Tagalog or Taglish guidance. Topic phrases keep the source wording to avoid mistranslating names. The guide is a starting selection, not a complete document catalogue: it samples the first 80 chunks, selects at most 8 passages and uses at most 10000 characters. A large corpus will need a dedicated source/topic catalogue for comprehensive discovery. No file-specific topic lists or question-to-answer rules were added.

Recent history is limited to six messages of 2000 characters each, excluding failed assistant responses. It helps rewrite follow-ups into standalone questions. History and user assertions are never evidence; factual answers still require retrieved documents and citations. The router and generator remain probabilistic, so neither routing nor grounding is guaranteed. The internal unknown marker is unchanged; the public conversation response is localized. Public authentication, exhaustive scope hardening and atomic indexing remain separate work.

Validation: 41 automated tests passed. Streamlit AppTest verified greeting rendering and history forwarding. Live tests covered English and Tagalog greetings with source-based guides, a greeting plus a factual Taglish question, a cancellation follow-up, an undocumented password question and thanks. The first free-form Tagalog guide had awkward mistranslations; the final guide uses exact source phrases with tested language-specific conversational wording. Restart Streamlit after module changes so cached imports refresh.

## Guide-focused response behavior and deterministic validation

The assistant gives short document-grounded answers, numbered guides when appropriate, and supported related topics. Simple facts, refusals, missing information and topic suggestions do not run step validation.

All factual generation uses strict Pydantic/JSON-schema output. A guide step has step_number, prerequisite (null, Step N/Hakbang N, or the exact earlier action), and action. The pure validate_guide function checks sequential numbers and declared dependencies in linear time. It makes no model, network or database calls. Explicit step references resolve to actual earlier actions; literal references ignore citation markers, letter case and whitespace. Missing, same-step and future prerequisites produce specific errors.

The default path has ONE answer-generation call after retrieval. There is no LLM audit, optional or otherwise. A code-validation failure allows one regeneration with the exact errors in validation_errors. If the second guide still fails, it is shown with a short localized caution. A failed/malformed repair retains the earlier guide with a caution. A malformed first response returns a friendly localized message. Citation identifiers are still checked against retrieved passages; invalid citations yield a friendly response rather than presenting unsupported source links.

Errors and separate generation_ms, parse_ms and validation_ms timings are written to ignored .private/chat-runtime.log with rotation. Full exceptions stay internal; the configured Supabase backend key is redacted from formatted logs. CLI and Streamlit response boundaries return nonblank messages without exposing tracebacks. The user-facing text arrives after strict parsing/code checks, as text events.

Run the full suite with `.\.venv\Scripts\python.exe -m unittest discover -p "test_*.py" -v`. Run `.\.venv\Scripts\python.exe verify_guide_validation.py` for one live guide, separate latency metrics, a code-only benchmark and a forced failure demo. No legacy audit is called for benchmarking.

Important limitation: deterministic validation checks the DECLARED dependency graph, not semantic entailment, omitted prerequisites or real-world policy correctness. A null/incorrectly declared prerequisite can still hide an omitted condition. Source citations and prompts do not prove every claim. The generated language/grounding still needs broader evaluation. The prior legacy audit had no timing instrumentation, so an exact before/after latency comparison to that removed audit is unavailable. Measured results for this change are in GUIDE_VALIDATION.md.

## Category-first opening and narrowing

The current local UI/CLI use bilingual category/topic data from menu_kb.json and per-chat state from menu_flow.py. Menus, typed/numeric selections, typo matching and Back/Menu commands are code-only. Specific questions skip forced menus; factual replies still use document retrieval and the same answer model. Topic selections are concise, and numbered guides require an explicit steps/paano/how-to request. Related topics are limited to two. See MENU_FLOW.md for configuration, state, reuse, verification and limitations.

## Session memory

The default UI/CLI entry point is now session_chat.stream_session_message. It loads/saves one per-chat session on every message, keeps eight minimized turns and navigation state, resolves follow-ups without a routing model, supports reset/new chat and 30-minute idle expiry, and passes safe recent context into the same generation call. Development defaults to an in-memory store; BB_SESSION_BACKEND=sqlite enables private restart-persistent storage. See SESSION_MEMORY.md for fields, privacy behavior, CLI/platform integration, concurrency, verified results and production limits.
