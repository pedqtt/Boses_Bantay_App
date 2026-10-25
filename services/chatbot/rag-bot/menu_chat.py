"""Thin adapter: local menus first, document retrieval only for answer decisions."""
import re

from chat import ChatEvent, UNKNOWN, stream_answer
from chat_runtime import runtime_logger
from guide_schema import FRIENDLY_ERROR
from menu_flow import load_kb, localized, remember_answer, category_menu, push


def stream_menu_answer(decision, state, database=None, models=None, kb=None, session_context=None):
    kb = kb or load_kb()
    if decision.kind != 'answer':
        yield ChatEvent('text', decision.text)
        yield ChatEvent('done', sources=decision.sources)
        return
    sources = ()
    answer = ''
    try:
        for event in stream_answer(decision.query, database, models, language=decision.language, response_mode=decision.mode, session_context=session_context):
            if event.kind == 'text':
                answer += event.text
            elif event.kind == 'done':
                sources = event.sources
        if answer == UNKNOWN:
            missing = {
                'english': "Sorry, I couldn't find that information in the available files. Please confirm with the Barangay Hall.",
                'tagalog': 'Paumanhin po, wala akong mahanap na impormasyong iyan sa mga available na file. Kumpirmahin po sa Barangay Hall.',
                'taglish': 'Sorry po, hindi ko mahanap ang information na iyan sa available files. Paki-confirm sa Barangay Hall.',
            }
            push(state)
            state.current_step = 'categories'
            state.selected_category = state.selected_topic = state.selected_detail = None
            answer = missing[decision.language] + '\n\n' + category_menu(kb, state)
            yield ChatEvent('text', answer)
            yield ChatEvent('done')
            return
        # The generator enforces concise prose. Do not truncate a validated
        # answer here: it can remove a conflicting claim or orphan its citation.
        source_parts = re.split(r'(?m)^(Sources|Pinagmulan):\s*$', answer, maxsplit=1)
        answer = source_parts[0].rstrip() + '\n\n' + localized(kb['back_option'], decision.language)
        if len(source_parts) == 3:
            answer += '\n\n' + source_parts[1] + ':\n\n' + source_parts[2].strip()
        remember_answer(state, answer, sources)
        yield ChatEvent('text', answer)
        yield ChatEvent('done', sources=sources)
    except Exception:
        runtime_logger().exception('menu_answer_failed')
        answer = FRIENDLY_ERROR[decision.language] + '\n\n' + localized(kb['back_option'], decision.language)
        remember_answer(state, answer)
        yield ChatEvent('text', answer)
        yield ChatEvent('done')
