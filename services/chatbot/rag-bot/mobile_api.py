"""Local/mobile HTTP adapter for the SAME session/RAG engine as app.py.

Run behind TLS and real user authentication for an internet deployment. The
mobile key is a public-app gate, not a privileged credential or user identity.
Signed random session bindings keep anonymous chats separate.
"""
import argparse
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import secrets
import threading
import time

import config
from chat_runtime import runtime_logger
from guide_schema import FRIENDLY_ERROR
from citations import UNVERIFIED
from menu_flow import load_kb, localized, opening
from session_chat import stream_session_message
from sessions import SQLiteSessionStore
from voice_gateway import VoiceGateway, VoiceFailure


class APIError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


class MobileChat:
    def __init__(self, store, signing_key, database_factory, models_factory):
        self.store, self.signing_key = store, signing_key
        self.database_factory, self.models_factory = database_factory, models_factory
        self.lock = threading.Lock()

    def new_session(self):
        nonce = secrets.token_hex(16)
        token = nonce + '.' + hmac.new(self.signing_key, nonce.encode(), hashlib.sha256).hexdigest()
        state = self.store.load(token)
        greeting = opening(state)
        self.store.save(state)
        return {'session_id': token, 'answer': greeting, 'status': 'menu'}

    def validate_session(self, token):
        if not isinstance(token, str) or not re.fullmatch(r'[a-f0-9]{32}\.[a-f0-9]{64}', token):
            raise APIError(400, 'Invalid chat session. Start a new chat.')
        nonce, signature = token.split('.')
        expected = hmac.new(self.signing_key, nonce.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise APIError(401, 'Invalid chat session. Start a new chat.')
        return token

    def reply(self, payload):
        if not isinstance(payload, dict):
            raise APIError(400, 'Expected a JSON object.')
        token = self.validate_session(payload.get('session_id'))
        query = payload.get('query')
        if not isinstance(query, str) or not 1 <= len(query.strip()) <= 4000:
            raise APIError(400, 'Enter a question between 1 and 4,000 characters.')
        if not self.lock.acquire(blocking=False):
            raise APIError(503, 'May kasalukuyang request po. Pakisubukan muli sandali.')
        try:
            events = list(stream_session_message(query, token, self.store,
                database_factory=self.database_factory, models_factory=self.models_factory))
            answer = ''.join(e.text for e in events if e.kind == 'text')
            sources = next((e.sources for e in reversed(events) if e.kind == 'done'), ())
            state = self.store.load(token)
            # The existing engine deliberately returns friendly text at its
            # response boundary. Recognize only its exact error-prefix constants.
            failed = any(answer.startswith(message) for message in [*FRIENDLY_ERROR.values(), *UNVERIFIED.values()])
            kb = load_kb()
            suggestions = []
            if not failed:
                if state.current_step == 'categories':
                    suggestions = [localized(c['name'], state.language) for c in kb['categories']]
                elif state.current_step == 'topics':
                    category = next((c for c in kb['categories'] if c['id'] == state.selected_category), None)
                    suggestions = [localized(t['name'], state.language) for t in category['topics']] if category else []
                elif state.current_step == 'detail':
                    suggestions = [localized(d['name'], state.language) for d in kb['details']]
            # Native Text is plain text, so don't show Markdown escape slashes.
            answer = re.sub(r'\\([\\`*_{}\[\]<>#|])', r'\1', answer)
            return {'answer': answer, 'session_id': token,
                'status': 'service_failure' if failed else ('menu' if state.current_step != 'answer' else 'answer'),
                'retryable': failed, 'language': state.language, 'current_step': state.current_step,
                'suggestions': suggestions,
                'sources': [{'id': p.number, 'documentTitle': p.source,
                             'section': ('pahina ' if state.language == 'tagalog' else 'page ') + str(p.page) if p.page else '',
                             'excerpt': p.content} for p in sources]}
        finally:
            self.lock.release()


def handler_for(engine, api_key, voice_gateway=None):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(15)
            self.request_started=time.perf_counter()
            self.request_id=secrets.token_hex(4)

        def log_message(self, *args):
            pass  # Do not persist questions, IP addresses, keys, or tokens.

        def respond(self, status, body):
            route=self.path if self.path in {'/health','/api/session','/api/chat','/transcribe','/extract','/summarize'} else '[unknown]'
            runtime_logger().info('http request_id=%s method=%s route=%s status=%d duration_ms=%.1f',
                self.request_id,self.command,route,status,(time.perf_counter()-self.request_started)*1000)
            data = json.dumps(body, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('X-Request-ID', self.request_id)
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            self.respond(200, {'status':'ok','service':'boses-rag-mobile', 'capabilities':['chat', *(['transcription','extraction','summarization'] if voice_gateway else [])]}) if self.path == '/health' else self.respond(404, {'error':'Not found'})

        def do_POST(self):
            try:
                # Browser origins are not needed by the native app. A separate
                # explicit CORS/auth deployment is required for web clients.
                if self.headers.get('Origin'):
                    raise APIError(403, 'Browser origins are not enabled for this native mobile adapter.')
                provided = self.headers.get('X-API-Key', '')
                if not hmac.compare_digest(provided.encode(), api_key.encode()):
                    raise APIError(401, 'Hindi tinanggap ang chatbot API key.')
                voice_route = self.path in {'/transcribe','/extract','/summarize'}
                if self.path not in {'/api/session','/api/chat'} and not voice_route:
                    raise APIError(404, 'Not found')
                if self.headers.get('Transfer-Encoding'):
                    raise APIError(400, 'Transfer encoding is not supported.')
                length = int(self.headers.get('Content-Length','0'))
                if voice_route:
                    if voice_gateway is None:
                        raise APIError(503, 'Hindi pa naka-configure ang speech service. Buksan muli ang Start Boses Bantay.')
                    if self.path != '/transcribe' and self.headers.get_content_type() != 'application/json':
                        raise APIError(415, 'Use application/json.')
                    result = voice_gateway.forward(self.path, self.rfile, length, self.headers.get('Content-Type',''))
                    self.respond(200, result)
                    return
                if not 0 < length <= 32768:
                    raise APIError(413, 'Request is empty or too large.')
                if self.headers.get_content_type() != 'application/json':
                    raise APIError(415, 'Use application/json.')
                payload = json.loads(self.rfile.read(length))
                if not isinstance(payload, dict):
                    raise APIError(400, 'Expected a JSON object.')
                body = engine.new_session() if self.path == '/api/session' else engine.reply(payload)
                self.respond(200, body)
            except (APIError, VoiceFailure) as error:
                self.respond(error.status, {'answer':error.message, 'retryable':error.status == 503,'status':'service_failure'})
            except (ValueError, UnicodeError):
                self.respond(400, {'answer':'Invalid request. Please retry.','status':'service_failure'})
            except (BrokenPipeError, ConnectionResetError, TimeoutError):
                pass
            except Exception:
                runtime_logger().exception('mobile_api_failed')
                self.respond(503, {'answer':FRIENDLY_ERROR['taglish'],'retryable':True,'status':'service_failure'})
    return Handler


class BoundedServer(ThreadingHTTPServer):
    daemon_threads = True
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.slots = threading.BoundedSemaphore(16)
    def process_request(self, request, address):
        if not self.slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, address)
        except Exception:
            self.slots.release()
            raise
    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request,address)
        finally:
            self.slots.release()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8503)
    args = parser.parse_args()
    key = os.environ.get('RAG_API_KEY','').strip()
    if len(key) < 24:
        raise SystemExit('Set a random RAG_API_KEY of at least 24 characters in the backend .env.')
    private = config.ROOT / '.private'
    private.mkdir(exist_ok=True)
    secret_file = private / 'mobile-session.key'
    try:
        with secret_file.open('xb') as target:
            target.write(secrets.token_bytes(32))
    except FileExistsError:
        pass
    secret = secret_file.read_bytes()
    if len(secret) != 32:
        raise SystemExit('Invalid mobile session signing key. Restore it before starting.')
    from ollama import Client
    from supabase import create_client
    def database():
        config.validate_supabase()
        return create_client(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY)
    store = SQLiteSessionStore(private / 'mobile-sessions.sqlite3')
    engine = MobileChat(store,secret,database,lambda: Client(host=config.OLLAMA_HOST,timeout=180))
    stopped = threading.Event()
    def cleanup():
        while not stopped.wait(60):
            store.purge_expired()
    threading.Thread(target=cleanup,daemon=True).start()
    voice = VoiceGateway(os.environ.get('VOICE_UPSTREAM_URL','http://127.0.0.1:8000'), os.environ.get('VOICE_UPSTREAM_API_KEY') or key)
    server = BoundedServer((args.host,args.port),handler_for(engine,key,voice))
    print(f'Mobile chatbot listening on {args.host}:{args.port}',flush=True)
    try:
        server.serve_forever()
    finally:
        stopped.set()
        server.server_close()

if __name__ == '__main__': main()
