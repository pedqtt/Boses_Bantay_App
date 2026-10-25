"""Load -> route with memory -> answer -> save, with no extra model calls."""
import re

from chat import ChatEvent
from chat_runtime import runtime_logger, fallback_language
from guide_schema import FRIENDLY_ERROR
from menu_flow import MenuDecision, handle_message, load_kb, normalized, opening
from menu_chat import stream_menu_answer
from sessions import add_turn, prompt_context


def redact_personal_text(text):
    """Reduce explicit personal fields before passing the current request onward.

    Stored history does not depend on this heuristic: it uses canonical menu
    summaries only, so arbitrary unrecognized names never enter the session DB.
    """
    text = re.sub(r'(?i)\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b', '[private]', text)
    text = re.sub(r'(?i)\b(?:my name is|name\s*:|pangalan ko(?: ay)?|ako si)\s+.*?(?=\s+(?:and|at|please|paki)\b|[.!?\n]|$)', '[private]', text)
    text = re.sub(r'(?i)\b(?:my address(?: is)?|address\s*:|tirahan ko(?: ay)?|nakatira (?:ako|kami) sa)\s*[^\n]*', '[private]', text)
    text = re.sub(r'(?i)\b(?:id(?: number)?|id no\.?|numero ng id)\s*[:#-]?\s*(?=[a-z0-9-]*\d)[a-z0-9-]{4,}', '[private]', text)
    return re.sub(r'(?<!\w)\+?\d(?:[\s()-]*\d){6,}(?!\w)', '[private]', text)


def stream_session_message(message, session_id, store, database=None, models=None,
                           database_factory=None, models_factory=None):
    """Always work from the stored session; commit before emitting a reply.

    An opaque chat/user binding can be supplied by any platform adapter. Explicit
    resets/expiry create a new generation at that binding, not another user's
    session. Concurrent stale saves fail safely instead of overwriting memory.
    """
    state = None
    decision = None
    reset = False
    events = []
    try:
        if not isinstance(session_id, str) or not session_id or len(session_id) > 128:
            raise ValueError('Use an opaque session id of 1-128 characters.')
        state = store.load(session_id)
        kb = load_kb()
        safe_message = redact_personal_text(message)
        reset = normalized(safe_message) in {normalized(x) for x in kb['commands']['reset']}
        if reset:
            state = store.reset(session_id)
            decision = MenuDecision('menu', opening(state, kb), language=state.language)
        else:
            decision = handle_message(safe_message, state, kb)
        if decision.kind == 'answer':
            if database is None and database_factory is not None:
                database = database_factory()
            if models is None and models_factory is not None:
                models = models_factory()
        events = list(stream_menu_answer(decision, state, database, models, kb,
                                         session_context=prompt_context(state, kb)))
    except Exception:
        runtime_logger().exception('session_message_failed')
        language = state.language if state else fallback_language(message)
        events = [ChatEvent('text', FRIENDLY_ERROR[language]), ChatEvent('done')]
    finally:
        if state is not None:
            try:
                state.updated_at = store.clock()
                if decision is not None and not reset:
                    add_turn(state, decision)
                store.save(state)
            except Exception:
                runtime_logger().exception('session_commit_failed')
                events = [ChatEvent('text', FRIENDLY_ERROR[state.language]), ChatEvent('done')]
    yield from events
