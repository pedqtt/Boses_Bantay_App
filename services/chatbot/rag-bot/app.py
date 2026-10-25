"""Local interactive interface for testing the Phase 5 pipeline."""
import streamlit as st
import re
import uuid
from ollama import Client
from supabase import create_client
import config
from chat import ChatFailure
from guide_schema import FRIENDLY_ERROR
from chat_runtime import runtime_logger, fallback_language
from menu_flow import ChatState, opening, current_menu, load_kb
from sessions import default_store
from session_chat import stream_session_message, redact_personal_text

st.set_page_config(page_title="Barangay document chat", page_icon="💬")
try:
    store = default_store()
    binding = st.query_params.get('chat', '')
    if not isinstance(binding, str) or re.fullmatch(r'[0-9a-f]{32}', binding) is None:
        binding = uuid.uuid4().hex
        st.query_params['chat'] = binding
    st.session_state.chat_session_id = binding
except Exception:
    runtime_logger().exception('session_store_setup_failed')
    st.error(FRIENDLY_ERROR['taglish'])
    st.stop()

st.title("Barangay document chat")
st.caption("Local Phase 5 test · Answers from your indexed documents")
st.warning("The index includes fictional test documents. These are not verified real barangay policies.")
with st.sidebar:
    st.header("Chat settings")
    st.write("Model: " + config.CHAT_MODEL)
    st.write(f"Retrieved passages: {config.TOP_K}")
    st.caption("Remembers your selected topic and recent turns. Menu / Mga Paksa returns to categories; Back / Balik goes back one step.")
    if st.button("Clear conversation"):
        store.delete(st.session_state.chat_session_id)
        st.query_params['chat'] = uuid.uuid4().hex
        st.session_state.messages = []
        st.session_state.pop('seen_generation', None)
        st.rerun()


def show_sources(sources):
    if sources:
        with st.expander("Source passages / Mga sipi"):
            for source in sources:
                location = f", page {source.page}" if source.page is not None else ""
                st.write(f"[{source.number}] {source.source}{location}")
                st.text(source.content)


try:
    state = store.load(st.session_state.chat_session_id)
    st.session_state.menu_state = state
    if st.session_state.get('seen_generation') != state.generation_id:
        st.session_state.messages = []
        st.session_state.seen_generation = state.generation_id
    if not state.opened:
        initial_text = opening(state)
        store.save(state)
        st.session_state.messages = [{"role":"assistant","content":initial_text,"sources":()}]
    elif not st.session_state.get('messages'):
        restored = []
        for turn in state.history:
            restored.extend([{'role':'user','content':turn['user_message']},
                             {'role':'assistant','content':turn['bot_reply']}])
        st.session_state.messages = restored or [{'role':'assistant','content':current_menu(load_kb(),state),'sources':()}]
except Exception:
    runtime_logger().exception('session_load_failed')
    st.error(FRIENDLY_ERROR['taglish'])
    st.stop()
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])
        if message.get("error"):
            st.error(message["error"])
        show_sources(message.get("sources", ()))

question = st.chat_input("Pumili ng numero o i-type ang tanong ninyo", max_chars=4000)
if question:
    with st.chat_message("user"):
        st.markdown(redact_personal_text(question))
    answer = ""
    sources = ()
    failure = None
    with st.chat_message("assistant"):
        display = st.empty()
        display.caption("Looking up documents, preparing an answer, and checking any guide steps...")
        try:
            def make_database():
                config.validate_supabase()
                return create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
            def make_models():
                return Client(host=config.OLLAMA_HOST, timeout=180)
            for event in stream_session_message(question, st.session_state.chat_session_id, store,
                                                 database_factory=make_database, models_factory=make_models):
                if event.kind == "text":
                    answer += event.text
                    display.markdown(answer + " ▌")
                elif event.kind == "done":
                    sources = event.sources
            display.markdown(answer)
            show_sources(sources)
        except Exception:
            runtime_logger().exception('streamlit_response_failed')
            failure = FRIENDLY_ERROR[fallback_language(question)]
        if failure:
            sources = ()
            if answer:
                answer = "**Incomplete or unverified answer. Do not rely on it.**\n\n" + answer
                display.markdown(answer)
                st.error(failure)
            else:
                answer = failure
                display.markdown(answer)
    refreshed = store.load(st.session_state.chat_session_id)
    st.session_state.menu_state = refreshed
    if refreshed.generation_id != st.session_state.seen_generation:
        st.session_state.seen_generation = refreshed.generation_id
        st.session_state.messages = [{'role':'assistant','content':answer,'sources':sources}]
        st.rerun()
    safe_user = refreshed.history[-1]['user_message'] if refreshed.history else 'New chat'
    st.session_state.messages.append({'role':'user','content':safe_user})
    st.session_state.messages.append({"role":"assistant","content":redact_personal_text(answer),"sources":sources,"error":failure})
    st.session_state.messages = st.session_state.messages[-16:]
