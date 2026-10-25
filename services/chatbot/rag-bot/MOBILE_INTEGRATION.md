# Mobile chatbot integration

The resident `bot.tsx` screen now calls the same Python session/RAG engine as the
Streamlit chat. The Cloudflare Worker is not redeployed or modified. The model is
local Ollama Qwen3:8b; this integration still requires the laptop/model server.

The greeting and six starter categories are imported from `menu_kb.json`. No
separate hardcoded common-question list is maintained. Initial category taps,
Menu, Back, topic selection, language switching, memory, guide validation, and
filename/page citations use the existing engine. The API stores minimized
session state in `.private/mobile-sessions.sqlite3` with 30-minute expiry.

## Run locally

Backend `.env` (private; no Expo prefix for backend secrets):

```
RAG_API_KEY=<random chatbot access key, at least 24 characters>
```

Keep the existing Supabase service-role key ONLY in the backend `.env`.

Mobile root `.env`:

```
EXPO_PUBLIC_RAG_API_URL=http://<laptop-Wi-Fi-IP>:8503
EXPO_PUBLIC_RAG_API_KEY=<matching chatbot access key>
```

From `services/chatbot/rag-bot`:

```
.\.venv\Scripts\python.exe mobile_api.py --host 0.0.0.0 --port 8503
```

Then restart Metro with `npx expo start --clear`. Use the app's existing compatible
development build (its existing native modules may not work in stock Expo Go).
The phone and laptop must be on the same trusted network. If the laptop's Wi-Fi
address changes, update the URL and restart Metro. Windows firewall or Android
cleartext policy can block LAN HTTP; no firewall rules or release manifest
exceptions are changed automatically. For release builds use a hosted HTTPS API,
not a private LAN URL. Expo web is not enabled by this native-only adapter.

The new transport explicitly requires the RAG URL/key; it does not silently fall
back to the older hosted chatbot when configuration is missing. EAS builds need
their own environment configuration. No new hosted deployment is performed.

## Contract and privacy

- `GET /health` returns service status without credentials.
- `POST /api/session` requires `X-API-Key` and creates an unpredictable signed
  session binding. The signing key stays on the backend.
- `POST /api/chat` accepts `{query, session_id}` with the same API key. Raw mobile
  transcript history is not transmitted. No names/user IDs are needed.
- New Chat obtains a new binding on the next request; the old session expires.
  Requests from an old screen are ignored, and duplicate sends are guarded.
- Filenames/pages and original excerpts are returned for the existing mobile
  citation cards. Native answer text includes a Sources / Pinagmulan block.
- HTTP errors and citation failures show retryable replies, never tracebacks.

The Expo key is extractable from a mobile app: it is only a local development
gate. Signed session tokens separate anonymous chats, not authenticated users.
Do not expose this development HTTP server publicly as-is. Public deployment
needs HTTPS, authenticated ownership, rate limits, and a production HTTP server.
Only one answer is processed at a time to protect the local model's capacity;
parallel requests receive a retryable busy response. No reindexing is necessary.

## Tests

Run the Python suite, including `test_mobile_api.py`. From repository root run:

```
node services/chatbot/rag-bot/test_mobile_client.cjs .
```

The client test transpiles the real TypeScript transport with a mocked network.
It checks shared categories, the session contract, all six suggestions, citation
metadata, and retryable errors. Phone rendering still needs a device check.

## One-click startup

Double-click `Start Boses Bantay.cmd` in the project root. It checks the local
setup, starts Ollama and the mobile API hidden when needed, then opens Expo in
that same console. Keep the console open while testing. Existing services are
reused. The launcher refreshes the local Wi-Fi API address before Expo starts.
If Expo is already running after an IP change, restart Expo to reload its env.
`Start Boses Bantay.cmd --check` checks setup without starting anything.
Startup logs are in `services/chatbot/rag-bot/.private/startup-*.log`.
