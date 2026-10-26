"""Authenticated same-address bridge to the existing loopback Whisper worker.

Audio is spooled temporarily and deleted after forwarding. No transcript/audio
content or upstream error payload is logged or returned as an error message.
"""
import http.client
import json
import tempfile
import threading
from urllib.parse import urlparse

MAX_AUDIO_BYTES = 20 * 1024 * 1024
MAX_JSON_BYTES = 32768
MAX_RESPONSE_BYTES = 1024 * 1024


class VoiceFailure(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


class VoiceGateway:
    def __init__(self, url, key):
        parsed = urlparse(url)
        if parsed.scheme != 'http' or parsed.hostname not in {'127.0.0.1', 'localhost'} or parsed.path not in {'', '/'} or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError('Whisper upstream must be a loopback HTTP service, without credentials or a path.')
        self.host, self.port = parsed.hostname, parsed.port or 8000
        self.key = key
        self.lock = threading.Lock()

    def forward(self, path, reader, length, content_type):
        if path not in {'/transcribe', '/extract', '/summarize'}:
            raise VoiceFailure(404, 'Hindi available ang endpoint na ito.')
        limit = MAX_AUDIO_BYTES if path == '/transcribe' else MAX_JSON_BYTES
        if not 0 < length <= limit:
            raise VoiceFailure(413, 'Masyadong malaki o walang laman ang recording. Mag-record po ng mas maikli.')
        if path == '/transcribe' and not content_type.lower().startswith('multipart/form-data;'):
            raise VoiceFailure(415, 'Hindi mabasa ang audio upload. Subukan pong mag-record muli.')
        if not self.lock.acquire(blocking=False):
            raise VoiceFailure(503, 'May pinoprosesong recording pa. Pakisubukan muli sandali.')
        connection = None
        try:
            with tempfile.SpooledTemporaryFile(max_size=1024 * 1024, mode='w+b') as body:
                remaining = length
                while remaining:
                    chunk = reader.read(min(65536, remaining))
                    if not chunk:
                        raise VoiceFailure(400, 'Hindi kumpleto ang audio upload. Pakisubukan muli.')
                    body.write(chunk)
                    remaining -= len(chunk)
                body.seek(0)
                connection = http.client.HTTPConnection(self.host, self.port, timeout=290)
                connection.putrequest('POST', path)
                connection.putheader('Content-Type', content_type)
                connection.putheader('Content-Length', str(length))
                connection.putheader('X-API-Key', self.key)
                connection.endheaders()
                while chunk := body.read(65536):
                    connection.send(chunk)
                response = connection.getresponse()
                data = response.read(MAX_RESPONSE_BYTES + 1)
                if response.status in {400, 413, 415, 422}:
                    raise VoiceFailure(422, 'Hindi mabasa ang recording. Subukan pong mag-record muli.')
                if response.status != 200 or len(data) > MAX_RESPONSE_BYTES:
                    raise VoiceFailure(503, 'Nagka-problema ang speech service. Pakisubukan muli.')
                result = json.loads(data)
                if path == '/transcribe' and (not isinstance(result, dict) or not isinstance(result.get('text'), str)):
                    raise ValueError('invalid_transcript_response')
                if path == '/extract' and not isinstance(result, dict):
                    raise ValueError('invalid_extraction_response')
                if path == '/summarize' and result is not None and not isinstance(result, dict):
                    raise ValueError('invalid_summary_response')
                return result
        except VoiceFailure:
            raise
        except (TimeoutError, OSError, http.client.HTTPException):
            raise VoiceFailure(503, 'Hindi pa maabot ang Whisper service. Buksan muli ang Start Boses Bantay at hintaying maging handa ang transcription.') from None
        except (ValueError, UnicodeError):
            raise VoiceFailure(503, 'Hindi wastong sagot ang natanggap mula sa speech service. Pakisubukan muli.') from None
        finally:
            if connection:
                connection.close()
            self.lock.release()
