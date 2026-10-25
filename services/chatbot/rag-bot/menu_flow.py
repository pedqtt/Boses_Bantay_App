"""Deterministic navigation. Knowledge-base JSON supplies all menu vocabulary.

This module never imports a model or database client and never provides policy facts.
"""
from dataclasses import dataclass, field
from difflib import SequenceMatcher
import json
from pathlib import Path
import re
import unicodedata
import time
import uuid

KB_PATH = Path(__file__).with_name('menu_kb.json')


@dataclass
class ChatState:
    session_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    generation_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    updated_at: float = field(default_factory=time.time)
    created_at: float = field(default_factory=time.time)
    last_answer_topic_id: str | None = None
    history: list = field(default_factory=list)
    store_version: int = 0
    current_step: str = 'categories'
    selected_category: str | None = None
    selected_topic: str | None = None
    selected_detail: str | None = None
    language: str = 'taglish'
    opened: bool = False
    last_answer: str = ''
    last_sources: tuple = ()
    trail: list = field(default_factory=list)

    @property
    def selected_category_id(self):
        return self.selected_category

    @selected_category_id.setter
    def selected_category_id(self, value):
        self.selected_category = value

    @property
    def selected_topic_id(self):
        return self.selected_topic

    @selected_topic_id.setter
    def selected_topic_id(self, value):
        self.selected_topic = value

    @property
    def nav_stack(self):
        return self.trail

    @nav_stack.setter
    def nav_stack(self, value):
        self.trail = value



@dataclass(frozen=True)
class MenuDecision:
    kind: str
    text: str = ''
    query: str = ''
    language: str = 'taglish'
    mode: str = 'concise'
    sources: tuple = ()


def load_kb(path=None):
    kb = json.loads(Path(path or KB_PATH).read_text(encoding='utf-8'))
    ids = set()
    for category in kb['categories']:
        if category['id'] in ids or not category['topics']:
            raise ValueError('Categories need unique ids and at least one topic.')
        ids.add(category['id'])
        for item in [category, *category['topics']]:
            if not all(isinstance(item['name'][locale], str) and item['name'][locale].strip() for locale in ['english', 'tagalog']):
                raise ValueError('Menu names require English and Tagalog text.')
    if not ids:
        raise ValueError('The category knowledge base cannot be empty.')
    return kb


def normalized(value):
    return ' '.join(re.findall(r'\w+', unicodedata.normalize('NFKC', value).casefold()))


def localized(value, language):
    return value.get(language, value['english'])


def aliases(item):
    return {normalized(value) for value in [*item['name'].values(), *item.get('aliases', [])]}


def phrase_in(phrase, message):
    return (' ' + normalized(phrase) + ' ') in (' ' + normalized(message) + ' ')


def best_matches(items, message, whole=False):
    text = normalized(message)
    words = text.split()
    ranked = []
    for item in items:
        best = (0, 0)
        for name in aliases(item):
            if name == text or (not whole and phrase_in(name, text)):
                score = (1, len(name))
            else:
                windows = [text] if whole else [' '.join(words[i:i+len(name.split())]) for i in range(len(words))]
                ratio = max((SequenceMatcher(None, name, window).ratio() for window in windows), default=0)
                score = (ratio if ratio >= .80 else 0, len(name))
            best = max(best, score)
        if best[0]:
            ranked.append((best, item))
    return [item for _, item in sorted(ranked, key=lambda pair: pair[0], reverse=True)]


def find_category(kb, state):
    return next((c for c in kb['categories'] if c['id'] == state.selected_category), None)


def find_topic(kb, state):
    category = find_category(kb, state)
    return next((t for t in category['topics'] if t['id'] == state.selected_topic), None) if category else None


def push(state):
    state.trail.append({key: getattr(state, key) for key in ['current_step', 'selected_category', 'selected_topic', 'selected_detail', 'last_answer', 'last_sources', 'last_answer_topic_id']})
    state.trail[:] = state.trail[-16:]


def category_menu(kb, state, greeting=False, initial=False):
    lines = [kb['greeting'] if initial else localized(kb['greetings'], state.language)] if greeting else []
    lines += [f"{i}. {localized(c['name'], state.language)} ({localized(c['example'], state.language)})" for i,c in enumerate(kb['categories'], 1)]
    lines.append(localized(kb['closing'], state.language))
    return '\n\n'.join([lines[0], '\n'.join(lines[1:-1]), lines[-1]]) if greeting else '\n'.join(lines[:-1]) + '\n\n' + lines[-1]


def topic_menu(kb, state, vague=False):
    category = find_category(kb, state)
    topics = category['topics']
    if vague:
        topics = topics[:4]
    title = localized(category['name'], state.language)
    choices = '\n'.join(f"{i}. {localized(t['name'], state.language)}" for i,t in enumerate(topics, 1))
    question = localized(kb['choose_topic'], state.language) if vague else localized(kb['category_question'], state.language).format(category=title)
    options = ' · '.join(localized(d['name'], state.language) for d in kb['details'])
    return title + '\n\n' + choices + '\n\n' + question + '\n' + localized(kb['quick_options'], state.language) + ': ' + options


def detail_menu(kb, state):
    topic = find_topic(kb, state)
    title = localized(topic['name'], state.language) if topic else ''
    choices = '\n'.join(f"{i}. {localized(d['name'], state.language)}" for i,d in enumerate(kb['details'], 1))
    return title + '\n\n' + choices + '\n\n' + localized(kb['category_question'], state.language).format(category=title)


def current_menu(kb, state):
    if state.current_step == 'topics' and find_category(kb, state):
        return topic_menu(kb, state)
    if state.current_step == 'detail' and find_topic(kb, state):
        return detail_menu(kb, state)
    if state.current_step == 'answer' and state.last_answer:
        return state.last_answer
    return category_menu(kb, state)


def opening(state, kb=None):
    kb = kb or load_kb()
    state.opened = True
    return category_menu(kb, state, greeting=True, initial=True)


def update_language(message, state, kb):
    text = normalized(message)
    if text in {'mga paksa', 'balik', 'bumalik', 'kategorya'}:
        state.language = 'tagalog'
        return
    if text.isdigit() or text in {normalized(x) for x in kb['commands']['back'] + kb['commands']['menu'] + kb['commands'].get('continue', [])}:
        return
    words = set(text.split())
    items = [*kb['categories'], *kb['details'], *(t for c in kb['categories'] for t in c['topics'])]
    tl_words = {word for item in items for word in normalized(item['name']['tagalog']).split()}
    en_words = {word for item in items for word in normalized(item['name']['english']).split()}
    localized_tl = words & (tl_words - en_words)
    if localized_tl or words & {'magandang', 'araw', 'ano', 'anong', 'paano', 'magkano', 'saan', 'kailan', 'sino', 'gaano', 'mga', 'paksa', 'po', 'gusto', 'kailangan', 'balik', 'kumusta', 'kamusta', 'sertipiko'}:
        state.language = 'taglish' if words & {'hello', 'please', 'requirements', 'fee', 'processing', 'steps', 'explain', 'office'} else 'tagalog'
    elif any(text == normalized(c['name']['tagalog']) for c in kb['categories']):
        state.language = 'tagalog'
    elif words & {'what', 'how', 'where', 'when', 'who', 'why', 'does', 'can'}:
        state.language = 'english'
    elif any(text in aliases(item) for item in kb['details']) and len(words) <= 2:
        return
    elif any(text in aliases(item) and item['name']['english'] == item['name']['tagalog'] for item in items):
        return
    elif re.search(r'[a-z]', text):
        state.language = 'english'


def answer_decision(message, state, kb, topic=None, detail=None, direct=False, category=None):
    push(state)
    if category:
        state.selected_category = category['id']
    if direct:
        state.selected_detail = None
    if topic:
        if topic['id'] != state.selected_topic:
            state.selected_detail = None
        state.selected_topic = topic['id']
    if detail:
        state.selected_detail = detail['id']
    state.current_step = 'detail' if detail else 'answer'
    if direct:
        query = message
        if state.selected_topic and not best_matches([find_topic(kb, state)], message):
            query += '\nCurrent topic: ' + localized(find_topic(kb, state)['name'], state.language)
    else:
        name = localized(find_topic(kb, state)['name'], state.language)
        chosen = detail or next((d for d in kb['details'] if d['id'] == state.selected_detail), None)
        query = localized(kb['detail_query'], state.language).format(topic=name, detail=localized(chosen['name'], state.language)) if chosen else localized(kb['overview_query'], state.language).format(topic=name)
    mode = 'guide' if (detail and detail['mode'] == 'guide') or any(phrase_in(x, message) for x in kb['step_triggers']) else 'concise'
    return MenuDecision('answer', query=query, language=state.language, mode=mode)


def handle_message(message, state, kb=None):
    kb = kb or load_kb()
    if not isinstance(message, str) or not message.strip() or len(message) > 4000:
        raise ValueError('Enter a message between 1 and 4000 characters.')
    text = normalized(message)
    first = not state.opened
    state.opened = True
    update_language(message, state, kb)
    for social in ['thanks', 'goodbye']:
        if text in {normalized(x) for x in kb['commands'][social]}:
            return MenuDecision('menu', localized(kb['social'][social], state.language) + '\n\n' + localized(kb['back_option'], state.language), language=state.language)
    if text in {normalized(x) for x in kb['commands']['back']}:
        if state.trail:
            snapshot = state.trail.pop()
            for key, value in snapshot.items():
                setattr(state, key, value)
            if state.current_step == 'answer' and 'last_answer' not in snapshot:
                topic = find_topic(kb, state)
                state.last_answer = localized(kb['memory_resume'], state.language).format(topic=localized(topic['name'],state.language) if topic else '')
                state.last_sources = ()
        return MenuDecision('menu', current_menu(kb, state), language=state.language, sources=state.last_sources if state.current_step == 'answer' else ())
    if text in {normalized(x) for x in kb['commands']['menu']}:
        push(state)
        state.current_step, state.selected_category, state.selected_topic, state.selected_detail = 'categories', None, None, None
        return MenuDecision('menu', category_menu(kb, state, greeting=first, initial=first), language=state.language)
    if text in {normalized(x) for x in kb['commands']['greeting']} and not first:
        if find_topic(kb, state):
            push(state); state.current_step = 'detail'
            return MenuDecision('menu', detail_menu(kb, state), language=state.language)
        if find_category(kb, state):
            return MenuDecision('menu', topic_menu(kb, state), language=state.language)
        return MenuDecision('menu', localized(kb['resume_prompt'], state.language), language=state.language)
    if text in {normalized(x) for x in kb['commands']['greeting']}:
        push(state)
        state.current_step, state.selected_category, state.selected_topic, state.selected_detail = 'categories', None, None, None
        return MenuDecision('menu', category_menu(kb, state, greeting=True, initial=first), language=state.language)

    category = find_category(kb, state)
    topic = find_topic(kb, state)
    if text in {normalized(x) for x in kb['commands'].get('continue', [])}:
        if topic:
            detail = next((d for d in kb['details'] if d['id'] == state.selected_detail), None)
            return answer_decision(message, state, kb, topic, detail)
        if category:
            return MenuDecision('menu', topic_menu(kb, state), language=state.language)
        return MenuDecision('menu', localized(kb['resume_prompt'], state.language), language=state.language)
    number = int(text) if text.isdigit() else None
    if number is not None:
        if state.current_step == 'categories' and 1 <= number <= len(kb['categories']):
            push(state); category = kb['categories'][number-1]
            state.current_step, state.selected_category, state.selected_topic, state.selected_detail = 'topics', category['id'], None, None
            return MenuDecision('menu', topic_menu(kb, state), language=state.language)
        if state.current_step == 'topics' and category and 1 <= number <= len(category['topics']):
            return answer_decision(message, state, kb, category['topics'][number-1], next((d for d in kb['details'] if d['id'] == state.selected_detail), None))
        if state.current_step == 'detail' and topic and 1 <= number <= len(kb['details']):
            return answer_decision(message, state, kb, topic, kb['details'][number-1])

    explicit_topics = [(c,t) for c in kb['categories'] for t in c['topics'] if text in aliases(t)]
    if explicit_topics:
        new_category, new_topic = explicit_topics[0]
        if (topic and new_topic['id'] != topic['id']) or (len(text.split()) >= 2 and text not in {alias for c in kb['categories'] for alias in aliases(c)}):
            return answer_decision(message, state, kb, new_topic, category=new_category)
    details = best_matches(kb['details'], message, whole=True)
    if details and topic:
        return answer_decision(message, state, kb, topic, details[0])
    if text in {normalized(x) for x in kb['commands']['details']} and topic:
        push(state); state.current_step = 'detail'
        return MenuDecision('menu', detail_menu(kb, state), language=state.language)

    all_topics = [(c, t) for c in kb['categories'] for t in c['topics']]
    topic_matches = best_matches([t for _,t in all_topics], message)
    whole_categories = best_matches(kb['categories'], message, whole=True)
    category_mentions = best_matches(kb['categories'], message)
    explicit_question = '?' in message or any(phrase_in(term, message) for term in kb['question_terms'])
    detail_in_question = best_matches(kb['details'], message)
    specific = explicit_question or (detail_in_question and len(text.split()) > 1)
    if whole_categories and text in aliases(whole_categories[0]):
        specific = False
    if specific and not topic_matches and category_mentions:
        push(state)
        category = category_mentions[0]
        state.current_step, state.selected_category, state.selected_topic = 'topics', category['id'], None
        state.selected_detail = detail_in_question[0]['id'] if detail_in_question else None
        return MenuDecision('menu', topic_menu(kb, state, vague=True), language=state.language)
    if specific and (topic_matches or whole_categories or (topic and detail_in_question) or any(phrase_in(term, message) for term in kb['scope_terms'])):
        chosen_topic = topic_matches[0] if topic_matches else topic
        chosen_category = next((c for c,t in all_topics if chosen_topic and t['id'] == chosen_topic['id']), None)
        return answer_decision(message, state, kb, chosen_topic, detail=detail_in_question[0] if detail_in_question else None, direct=True, category=chosen_category)

    if whole_categories:
        push(state); category = whole_categories[0]
        state.current_step, state.selected_category, state.selected_topic, state.selected_detail = 'topics', category['id'], None, None
        return MenuDecision('menu', topic_menu(kb, state), language=state.language)
    if topic_matches:
        chosen = topic_matches[0]
        if category and state.current_step == 'topics' and any(t['id'] == chosen['id'] for t in category['topics']):
            return answer_decision(message, state, kb, chosen)
        push(state)
        category = next(c for c,t in all_topics if t['id'] == chosen['id'])
        state.current_step, state.selected_category, state.selected_topic, state.selected_detail = 'topics', category['id'], None, None
        return MenuDecision('menu', topic_menu(kb, state, vague=True), language=state.language)
    if details and category:
        push(state); state.current_step, state.selected_detail = 'topics', details[0]['id']
        return MenuDecision('menu', topic_menu(kb, state, vague=True), language=state.language)

    if details:
        push(state)
        state.current_step, state.selected_category, state.selected_topic, state.selected_detail = 'categories', None, None, None
        return MenuDecision('menu', category_menu(kb, state, greeting=first, initial=first), language=state.language)

    push(state)
    state.current_step, state.selected_category, state.selected_topic, state.selected_detail = 'categories', None, None, None
    return MenuDecision('menu', localized(kb['unsupported'], state.language) + '\n\n' + category_menu(kb, state, greeting=first, initial=first), language=state.language)


def remember_answer(state, text, sources=()):
    state.current_step, state.last_answer, state.last_sources = 'answer', text, tuple(sources)
    state.last_answer_topic_id = state.selected_topic
