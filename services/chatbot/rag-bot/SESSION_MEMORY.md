# Per-chat conversation memory

The UI and CLI call session_chat.stream_session_message for every message. It loads the current session, handles navigation and short follow-ups in code, uses the existing answer-generation call only when needed, and commits state before returning the reply. The displayed transcript is not the routing source of truth.

## Stored state

- session_id: opaque chat binding. generation_id distinguishes a fresh chat after expiry/reset while retaining an external platform binding.
- language: en, tl or taglish in storage; the existing menu engine uses english/tagalog/taglish labels internally for compatibility.
- current_step: categories, topics, detail or answer.
- selected_category_id, selected_topic_id, selected_detail_id and last_answer_topic_id.
- history: the last eight user/bot turns as compact menu-derived topic/intent summaries, not verbatim personal messages or factual evidence.
- nav_stack: up to 16 previous navigation states.
- created_at and updated_at: UTC epoch seconds. A version guards concurrent saves.

The store schema deliberately excludes raw user messages, raw generated answers, personal identity fields, cached source excerpts and full cached answers. History summaries are rebuilt from approved menu identifiers/labels at the storage boundary, so arbitrary user-provided text cannot be injected into stored history. Explicit personal fields are also redacted before the current request reaches the answer pipeline. That heuristic does not need to recognize every possible name because raw inputs are never the stored history. Use opaque IDs, never names/addresses/phone numbers, as external chat bindings.

The UI keeps a bounded, redacted presentation transcript in its own active browser session. SQLite restores the minimized summaries, not the full prior answers/source excerpts. Back can restore the previous topic/detail without persisting the old factual answer; asking again retrieves fresh supporting records.

## Lifecycle and follow-ups

A new session starts only at a new binding, reset/new chat, or expiry. Each fresh epoch gets one opening greeting. Repeated hello does not clear a selected topic or re-show the categories. The default idle timeout is 30 minutes. Expired records are rejected/deleted on access, and the running default store also purges every 60 seconds. An idle browser clears its old presentation on its next interaction/reload.

Short details such as magkano?, ano requirements? and paano? resolve against the selected topic. yan/yun/ok/sige/yung isa keep the same topic and requested detail. A clearly named different topic replaces old topic/detail context. Menu clears the active category/topic; Back restores the previous navigation snapshot. Numeric choices are resolved using current_step. Short technical detail labels preserve language; full English/Tagalog/Taglish questions can switch it.

The existing generation payload receives current state and up to eight minimized recent turns via session_context. The system prompt treats that context only as navigation, never evidence. Factual claims still need newly retrieved document passages. Memory adds zero routing or validation LLM calls.

## Development and production storage

Development uses an in-memory dictionary keyed by session_id. State survives ordinary UI reruns/reconnects in the same server process, but not a process restart. The browser URL contains an opaque chat binding so a reconnect uses the same chat instead of creating a new state each message.

For persistent SQLite, add this line to the ignored rag-bot/.env and restart the server:

```dotenv
BB_SESSION_BACKEND=sqlite
```

The default database is .private/chat-sessions.sqlite3. Optionally set BB_SESSION_SQLITE_PATH to a private absolute file path. SQLite uses parameterized queries, WAL, closed connections, expiry cleanup and version/generation checks to reject stale concurrent saves rather than overwrite another message. It supports multiple workers sharing that local file. Multi-host deployments require a shared store implementation, such as Redis or the platform's server-side session storage; that adapter is not included.

The anonymous local UI binding is not authentication. In a public platform adapter, bind sessions to a trusted authenticated user/chat ID and enforce ownership; do not trust an arbitrary client-supplied identifier. Messenger/Telegram adapters can supply their validated opaque chat binding to the same session entry point.

## CLI

The CLI keeps one binding throughout its loop and loads/saves it each turn. Reset/new chat clears that binding's old history; exit ends the loop. To resume an explicitly identified chat across CLI restarts with SQLite enabled, use:

```powershell
.\.venv\Scripts\python.exe chat.py --session-id opaque-chat-01
```

Do not use a person's identity as this argument. For normal development, omit it to start a new opaque chat.

## Adapter entry point

```python
from sessions import default_store
from session_chat import stream_session_message

store = default_store()
# Use an opaque, trusted binding supplied by your platform.
for event in stream_session_message("Menu", "opaque-chat-01", store):
    if event.kind == "text":
        print(event.text)
```

Provide database_factory and models_factory for factual answers. Menus/reset/navigation do not initialize those clients. The module handles load/save and failures centrally. Stale concurrent requests return a friendly retry response; platform adapters should serialize deliveries for one chat when possible.

## Verification (25 October 2026, Singapore)

All 95 tests passed. Coverage includes existing behavior plus remembered fees/requirements/steps/pronouns, number scope, Back/Menu, topic changes, language switching, expiry/new greeting, reset, eight-turn bounds, privacy-safe payloads, isolated IDs, stale-save rejection, SQLite recovery across actual Python processes, and web UI recovery through a fresh app/store instance.

Live test: Barangay clearance followed by magkano? returned the documented fictional PHP 35 fee with the synthetic resident-guide citation. The follow-up took 6.72 seconds on this run. Two factual turns used two generation calls total; the second call included remembered topic/detail and one prior summarized turn. Menu/Back added zero model calls. These are local test timings, not a performance guarantee. Test data are fictional and do not establish real barangay policy.
