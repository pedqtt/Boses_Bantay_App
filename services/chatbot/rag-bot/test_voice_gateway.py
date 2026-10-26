from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from types import SimpleNamespace

from mobile_api import BoundedServer, handler_for
from voice_gateway import VoiceGateway, VoiceFailure, MAX_AUDIO_BYTES


class VoiceGatewayTests(unittest.TestCase):
    def setUp(self):
        self.received=[]; self.status=200; self.result={'text':'Synthetic test transcription.'}
        owner=self
        class Worker(BaseHTTPRequestHandler):
            def log_message(self,*args): pass
            def do_POST(self):
                body=self.rfile.read(int(self.headers['Content-Length']))
                owner.received.append((self.path,body,self.headers.get('X-API-Key'),self.headers.get('Content-Type')))
                raw=json.dumps(owner.result).encode()
                self.send_response(owner.status); self.send_header('Content-Length',str(len(raw))); self.end_headers(); self.wfile.write(raw)
        self.worker=ThreadingHTTPServer(('127.0.0.1',0),Worker)
        threading.Thread(target=self.worker.serve_forever,daemon=True).start()
        self.voice=VoiceGateway(f'http://127.0.0.1:{self.worker.server_port}','internal-test-key')
        self.api=BoundedServer(('127.0.0.1',0),handler_for(SimpleNamespace(),'mobile-test-key',self.voice))
        threading.Thread(target=self.api.serve_forever,daemon=True).start()
        self.addCleanup(self.close_servers)

    def close_servers(self):
        for server in [self.api,self.worker]: server.shutdown(); server.server_close()

    def post(self,path,body,content_type='multipart/form-data; boundary=test-boundary',key='mobile-test-key'):
        req=Request(f'http://127.0.0.1:{self.api.server_port}'+path,data=body,
            headers={'Content-Type':content_type,'X-API-Key':key})
        with urlopen(req,timeout=5) as response: return json.load(response)

    def test_multipart_and_field_forwarded_unchanged_through_shared_api(self):
        payload=b'--test-boundary\r\nContent-Disposition: form-data; name="field"\r\n\r\ndescription\r\n--test-boundary\r\nContent-Disposition: form-data; name="file"; filename="clip.m4a"\r\nContent-Type: audio/mp4\r\n\r\nsynthetic-bytes\r\n--test-boundary--\r\n'
        self.assertEqual(self.post('/transcribe',payload)['text'],'Synthetic test transcription.')
        path,body,key,content_type=self.received[0]
        self.assertEqual(path,'/transcribe'); self.assertEqual(body,payload)
        self.assertEqual(key,'internal-test-key'); self.assertIn('boundary=test-boundary',content_type)

    def test_wrong_mobile_key_never_reaches_worker(self):
        with self.assertRaises(HTTPError) as caught: self.post('/transcribe',b'audio',key='bad')
        self.assertEqual(caught.exception.code,401); self.assertEqual(self.received,[])

    def test_extract_and_summary_share_gateway(self):
        self.result={'location':'synthetic location'}
        payload=json.dumps({'transcript':'synthetic location','chunk':'story'}).encode()
        self.assertEqual(self.post('/extract',payload,'application/json'),self.result)
        self.result=None
        self.assertIsNone(self.post('/summarize',b'{}','application/json'))

    def test_worker_error_is_friendly_and_does_not_expose_payload(self):
        self.status=500; self.result={'error':'sensitive-internal-payload'}
        with self.assertRaises(HTTPError) as caught: self.post('/transcribe',b'audio')
        self.assertEqual(caught.exception.code,503)
        self.assertNotIn('sensitive-internal-payload',caught.exception.read().decode())

    def test_size_media_type_and_incomplete_upload_are_rejected(self):
        for body,length,ctype,status in [(b'',MAX_AUDIO_BYTES+1,'multipart/form-data; boundary=b',413),
                (b'a',1,'application/json',415),(b'a',3,'multipart/form-data; boundary=b',400)]:
            with self.assertRaises(VoiceFailure) as caught: self.voice.forward('/transcribe',io.BytesIO(body),length,ctype)
            self.assertEqual(caught.exception.status,status)
        self.assertEqual(self.received,[])

    def test_malformed_response_is_not_a_transcript(self):
        self.result={'text':123}
        with self.assertRaises(HTTPError) as caught: self.post('/transcribe',b'audio')
        self.assertEqual(caught.exception.code,503)

    def test_busy_voice_worker_is_retryable(self):
        self.voice.lock.acquire()
        try:
            with self.assertRaises(HTTPError) as caught: self.post('/transcribe',b'audio')
            self.assertEqual(caught.exception.code,503)
        finally: self.voice.lock.release()

    def test_remote_upstream_not_allowed(self):
        with self.assertRaises(ValueError): VoiceGateway('https://untrusted.example','test-key')

if __name__=='__main__': unittest.main()
