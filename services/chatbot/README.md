# Hosted Barangay Assistant

The Expo app calls a Cloudflare Worker. Workers AI embeds questions and generates reviewed answers using approved, revision-validated passages in the existing Supabase database. Chat requests do not require the development laptop or ngrok.

## Development and deployment

Run `npm ci`, `npm test`, then `npx wrangler deploy` from this directory. Review `wrangler.jsonc` for your account and model configuration. Configure Worker secrets with `npx wrangler secret put SUPABASE_PUBLIC_KEY` and `npx wrangler secret put CHAT_API_KEY`. Never upload a Supabase service-role key to this Worker.

For local Expo development, set `EXPO_PUBLIC_CHAT_API_URL` to the Worker URL and `EXPO_PUBLIC_CHAT_API_KEY` to the chatbot access key in the ignored root `.env`. Set the same variables in the appropriate EAS environment before building an APK. Also configure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Keys are deliberately absent from tracked build configuration. The mobile chatbot key is an app-shipped access identifier, not an administrator secret; rate limits and provider quotas still apply.

## Retrieval and responses

The pipeline uses compatible BGE-M3 embeddings, multiple query formulations, hybrid retrieval, rank fusion, deduplication and bounded, document-diverse context assembly. It validates exact supporting quotes, numeric claims, semantic support, document approval and current revisions before returning citations. Broad discovery requests can offer supported questions and tappable follow-ups. Conversation history helps navigation but is never factual evidence.

Barangay-only scope and prompt hardening apply to user messages and retrieved text. Missing content, partial support, clarification, conflicting sources, low confidence and technical failures have separate response paths. Service failures must never be represented as absent records.

## Indexing

`indexing/migrations` contains the four migrations already applied to the configured project; do not blindly reapply them. They provide revision tracking, leased jobs, protected chunks, hybrid search, staging and atomic batched publication. `indexing/server` contains the Python ingestion worker and local inference tooling. Install `indexing/requirements.txt` plus a platform-appropriate PyTorch build, download pinned models with `indexing/download_models.py`, run the inference service, then the worker. Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `BB_INFERENCE_URL`, and server-only `SUPABASE_SERVICE_KEY` (or a Windows DPAPI credential). Optional `BB_SOURCE_ROOT` supplies source files where approved section text is unavailable; `BB_MOBILE_ENV` selects a mobile environment file. Keep all administrator credentials off mobile and out of Git.

The current indexing worker still runs locally: existing indexed records can be queried online with the laptop off, but newly approved or changed documents require a running worker to become searchable. The older Python retrieval/generation tools are retained as source tooling; the hosted chatbot uses the JavaScript Worker.

## Validation and remaining limits

The latest automated JavaScript suite passes 48 tests; the mobile TypeScript check passed. Earlier live checks exercised discovery and document answers, but final live verification of the newest model/review changes was blocked when the Cloudflare free daily AI quota was exhausted on 23 October 2026 (Singapore time). Do not treat automated success as full production acceptance. No paid plan was enabled. Quota resets at 00:00 UTC; each request may use several AI calls. The health endpoint checks configuration and catalogue availability, not remaining AI quota.

The current corpus is small. Recheck multilingual questions, multi-document answers, ambiguity, unsupported questions and follow-up navigation against an expanded approved corpus. Generated-answer checks reduce unsupported claims but are not a guarantee. No AI-free record browser fallback is implemented yet. Existing source-document table permissions remain a separate security limitation: protected chunks do not establish the integrity of an anonymously writable source table. Review those permissions before a public rollout.
