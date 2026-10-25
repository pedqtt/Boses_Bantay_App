"""Minimal per-chat session storage with TTL and optimistic save protection.

Persist only trusted navigation identifiers and compact turn summaries. Raw user
messages, generated answers, source excerpts, names, addresses and ID values are
not part of the stored schema.
"""
from copy import deepcopy
from contextlib import contextmanager
from functools import lru_cache
import json
import os
from pathlib import Path
import sqlite3
import threading
import time

from menu_flow import ChatState, load_kb, localized

TIMEOUT_SECONDS = 30 * 60
HISTORY_TURNS = 8


class SessionConflict(RuntimeError):
    pass


def canonical_turn(item, kb):
    category = next((c for c in kb['categories'] if c['id'] == item.get('category_id')), None)
    topic = next((t for t in category['topics'] if t['id'] == item.get('topic_id')), None) if category else None
    detail = next((d for d in kb['details'] if d['id'] == item.get('detail_id')), None)
    language = item.get('language', 'english')
    if language not in {'english', 'tagalog', 'taglish'}:
        language = 'english'
    subject = localized(topic['name'], language) if topic else localized(category['name'], language) if category else 'categories'
    intent = localized(detail['name'], language) if detail else ('overview' if topic else 'navigation')
    kind = item.get('kind') if item.get('kind') in {'answer', 'menu'} else 'menu'
    reply = {'english': f'We discussed {subject} ({intent}).', 'tagalog': f'Pinag-usapan natin ang {subject} ({intent}).', 'taglish': f'Na-discuss natin ang {subject} ({intent}).'}[language]
    return {'user_message': f'{intent}: {subject}', 'bot_reply': reply,
            'category_id': category['id'] if category else None, 'topic_id': topic['id'] if topic else None,
            'detail_id': detail['id'] if detail else None, 'language': language, 'kind': kind,
            'timestamp': item.get('timestamp') if isinstance(item.get('timestamp'), (int,float)) else 0}


def encode(state):
    kb = load_kb()
    categories = {c['id'] for c in kb['categories']}
    topics = {t['id'] for c in kb['categories'] for t in c['topics']}
    details = {d['id'] for d in kb['details']}
    def safe(value, allowed):
        return value if isinstance(value, str) and value in allowed else None
    stack = []
    for item in state.trail[-16:]:
        stack.append({'current_step': item['current_step'] if item.get('current_step') in {'categories','topics','detail','answer'} else 'categories',
                      'selected_category': safe(item.get('selected_category'),categories),
                      'selected_topic': safe(item.get('selected_topic'),topics),
                      'selected_detail': safe(item.get('selected_detail'),details),
                      'last_answer_topic_id': safe(item.get('last_answer_topic_id'),topics)})
    return {
        'session_id': state.session_id, 'generation_id': state.generation_id,
        'language': {'english': 'en', 'tagalog': 'tl', 'taglish': 'taglish', 'en':'en', 'tl':'tl'}[state.language],
        'current_step': state.current_step,
        'selected_category_id': safe(state.selected_category,categories),
        'selected_topic_id': safe(state.selected_topic,topics),
        'selected_detail_id': safe(state.selected_detail,details),
        'last_answer_topic_id': safe(state.last_answer_topic_id,topics),
        'opened': state.opened, 'updated_at': state.updated_at,
        'created_at': state.created_at,
        'history': [canonical_turn(item,kb) for item in state.history[-HISTORY_TURNS:] if isinstance(item,dict)],
        'nav_stack': stack,
    }


def decode(payload, version=0):
    state = ChatState(session_id=payload['session_id'], generation_id=payload['generation_id'],
        language={'en': 'english', 'tl': 'tagalog', 'taglish': 'taglish'}[payload['language']],
        current_step=payload['current_step'], selected_category=payload['selected_category_id'],
        selected_topic=payload['selected_topic_id'], selected_detail=payload['selected_detail_id'],
        last_answer_topic_id=payload['last_answer_topic_id'], opened=payload['opened'],
        updated_at=payload['updated_at'], created_at=payload['created_at'],
        history=deepcopy(payload['history'][-HISTORY_TURNS:]), trail=deepcopy(payload['nav_stack']),
        store_version=version)
    # Back can replay a non-factual summary without persisting answer/source text.
    state.last_answer = state.history[-1]['bot_reply'] if state.history else ''
    return state


def new_state(session_id, now):
    return ChatState(session_id=session_id, updated_at=now, created_at=now)


class MemorySessionStore:
    def __init__(self, timeout=TIMEOUT_SECONDS, clock=time.time):
        self.timeout, self.clock = timeout, clock
        self.sessions = {}
        self.lock = threading.RLock()

    def purge_expired(self):
        with self.lock:
            cutoff = self.clock() - self.timeout
            for key in [key for key, (_, data) in self.sessions.items() if data['updated_at'] <= cutoff]:
                del self.sessions[key]

    def load(self, session_id):
        with self.lock:
            self.purge_expired()
            if session_id not in self.sessions:
                self.sessions[session_id] = (0, encode(new_state(session_id, self.clock())))
            version, data = self.sessions[session_id]
            return decode(deepcopy(data), version)

    def save(self, state):
        with self.lock:
            self.purge_expired()
            current = self.sessions.get(state.session_id)
            if current is None or current[0] != state.store_version or current[1]['generation_id'] != state.generation_id:
                raise SessionConflict('Session changed while this message was being processed.')
            state.updated_at = self.clock()
            state.store_version += 1
            self.sessions[state.session_id] = (state.store_version, encode(state))

    def delete(self, session_id):
        with self.lock:
            self.sessions.pop(session_id, None)

    def reset(self, session_id):
        self.delete(session_id)
        return self.load(session_id)


class SQLiteSessionStore:
    """Shared local SQLite file, WAL and CAS writes; no pickle or raw transcripts."""
    def __init__(self, path, timeout=TIMEOUT_SECONDS, clock=time.time):
        self.path, self.timeout, self.clock = Path(path), timeout, clock
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('CREATE TABLE IF NOT EXISTS chat_sessions (session_id TEXT PRIMARY KEY, version INTEGER NOT NULL, updated_at REAL NOT NULL, payload TEXT NOT NULL)')
            db.execute('CREATE INDEX IF NOT EXISTS chat_sessions_updated_at ON chat_sessions(updated_at)')

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.path, timeout=15)
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def purge_expired(self):
        with self.connect() as db:
            db.execute('DELETE FROM chat_sessions WHERE updated_at <= ?', (self.clock()-self.timeout,))

    def load(self, session_id):
        now = self.clock()
        with self.connect() as db:
            db.execute('DELETE FROM chat_sessions WHERE updated_at <= ?', (now-self.timeout,))
            payload = json.dumps(encode(new_state(session_id, now)), ensure_ascii=False)
            db.execute('INSERT OR IGNORE INTO chat_sessions VALUES (?,0,?,?)', (session_id, now, payload))
            row = db.execute('SELECT version,payload FROM chat_sessions WHERE session_id=?', (session_id,)).fetchone()
        return decode(json.loads(row[1]), row[0])

    def save(self, state):
        self.purge_expired()
        now = self.clock()
        state.updated_at = now
        payload = json.dumps(encode(state), ensure_ascii=False)
        with self.connect() as db:
            cursor = db.execute('UPDATE chat_sessions SET version=version+1, updated_at=?, payload=? WHERE session_id=? AND version=? AND json_extract(payload,\'$.generation_id\')=?',
                                (now, payload, state.session_id, state.store_version, state.generation_id))
            if cursor.rowcount != 1:
                raise SessionConflict('Session changed while this message was being processed.')
        state.store_version += 1

    def delete(self, session_id):
        with self.connect() as db:
            db.execute('DELETE FROM chat_sessions WHERE session_id=?', (session_id,))

    def reset(self, session_id):
        self.delete(session_id)
        return self.load(session_id)


def add_turn(state, decision, kb=None):
    """Only canonical menu-derived summaries, never arbitrary user/bot content."""
    kb = kb or load_kb()
    category = next((c for c in kb['categories'] if c['id'] == state.selected_category), None)
    topic = next((t for t in category['topics'] if t['id'] == state.selected_topic), None) if category else None
    detail = next((d for d in kb['details'] if d['id'] == state.selected_detail), None)
    subject = localized(topic['name'], state.language) if topic else localized(category['name'], state.language) if category else 'categories'
    intent = localized(detail['name'], state.language) if detail else ('overview' if topic else state.current_step)
    state.history.append({'user_message': f'{intent}: {subject}',
                          'bot_reply': f'{decision.kind}: {intent} / {subject}',
                          'category_id': state.selected_category, 'topic_id': state.selected_topic,
                          'detail_id': state.selected_detail, 'timestamp': state.updated_at, 'kind': decision.kind, 'language': state.language})
    state.history[:] = state.history[-HISTORY_TURNS:]


def prompt_context(state, kb=None):
    kb = kb or load_kb()
    categories = {c['id']: c for c in kb['categories']}
    category = categories.get(state.selected_category)
    topic = next((t for t in category['topics'] if t['id'] == state.selected_topic), None) if category else None
    return {'current_step': state.current_step, 'selected_category_id': state.selected_category,
            'selected_topic_id': state.selected_topic, 'last_answer_topic_id': state.last_answer_topic_id,
            'selected_detail_id': state.selected_detail, 'language': state.language,
            'topic_label': localized(topic['name'], state.language) if topic else None,
            'recent_turns': deepcopy(state.history[-HISTORY_TURNS:])}


def start_cleanup(store, interval=60):
    def cleanup():
        while True:
            time.sleep(interval)
            try:
                store.purge_expired()
            except Exception:
                from chat_runtime import runtime_logger
                runtime_logger().exception('session_cleanup_failed')
    thread = threading.Thread(target=cleanup, name='chat-session-cleanup', daemon=True)
    thread.start()


@lru_cache(maxsize=1)
def default_store():
    backend = os.getenv('BB_SESSION_BACKEND', 'memory').lower()
    if backend == 'memory':
        store = MemorySessionStore()
    elif backend == 'sqlite':
        import config
        store = SQLiteSessionStore(os.getenv('BB_SESSION_SQLITE_PATH', str(config.ROOT / '.private' / 'chat-sessions.sqlite3')))
    else:
        raise ValueError('BB_SESSION_BACKEND must be memory or sqlite.')
    start_cleanup(store)
    return store
