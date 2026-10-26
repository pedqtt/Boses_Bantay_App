# Shared chatbot and transcription address

The mobile app uses `EXPO_PUBLIC_RAG_API_URL` and its matching public-app key for:

- `/api/session` and `/api/chat`: the current session/RAG chatbot.
- `/transcribe`: the real multipart audio upload, including its optional field.
- `/extract` and `/summarize`: the existing best-effort report helper routes.

There is no built-in ngrok URL or canned transcription fallback. An explicitly
configured legacy Whisper URL is supported only when the RAG URL is absent.

## One-click startup

Double-click `Start Boses Bantay.cmd` on the Desktop or in the project root.
The launcher starts/reuses Ollama, the existing Whisper worker, the shared API,
and Expo. Whisper runs hidden on **127.0.0.1:8000**, using its existing environment
and cached model. The phone only needs the shared API address on **port 8503**.
No speech ngrok tunnel is launched. The laptop must stay on.

The default service directory is the sibling `whisper-server` folder. On this
installation it is:

```
C:\Users\Paul Braganza\Downloads\BOSES BANTAY\whisper-server
```

The launcher invokes `venv\Scripts\python.exe` directly; a separate activation
terminal is unnecessary. It waits for the Whisper health check before continuing.
Its output is in the ignored `.private/startup-whisper.log`. The existing speech
service source/environment must remain installed separately at that location.

Backend `.env` overrides:

```
WHISPER_SERVICE_DIR=C:/path/to/whisper-server
# Optional if the environment is not inside that directory:
WHISPER_PYTHON=C:/path/to/whisper-server/venv/Scripts/python.exe
VOICE_UPSTREAM_URL=http://127.0.0.1:8000
```

The worker key defaults to the chatbot key. For a separately managed worker,
set `VOICE_UPSTREAM_API_KEY` to its matching key privately. Restart the worker
if changing that key; the launcher does not kill existing processes.
The launcher selects the already installed Qwen3:8b for the existing optional
report helpers; those helpers can still fail independently of transcription.

The launcher requires the speech model to be cached (`HF_HUB_OFFLINE=1`). If
starting on a new machine, set up the separate Whisper environment/model first.
The existing GPU/Tagalog/Taglish speech settings are retained unless overridden
with `WHISPER_MODEL`, `WHISPER_DEVICE`, `WHISPER_COMPUTE_TYPE`, or `WHISPER_LANGUAGE`.

## Upload handling

The gateway authenticates the mobile key, accepts at most 20 MB for a complete
multipart upload, forwards only to loopback, and deletes its temporary spool.
The original audio bytes, multipart boundary and field are preserved. The
gateway does not store recordings or transcript content. The existing worker
uses temporary decoding files and its own local logging behavior.

Wrong keys, invalid uploads, busy/offline workers, malformed results and silence
produce friendly messages. Technical failures are not converted into invented
transcripts. The extraction/summarization calls remain optional so a report can
continue when those helpers are unavailable.

## Verification

`test_voice_gateway.py` covers real local HTTP forwarding, auth, payload limits,
busy/error behavior, and the report-helper routes with a stub worker.
`test_transcribe_client.cjs` checks the actual TypeScript client with a mocked
network, including shared URL/key precedence and no fake transcript fallback.

An actual synthetic M4A upload through port 8503 was transcribed successfully
using the existing GPU Whisper worker. This is a connectivity smoke test, not
an accuracy benchmark or a guarantee of correct names in resident recordings.
