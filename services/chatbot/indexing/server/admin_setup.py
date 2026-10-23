"""Loopback-only, nonce-protected handoff for reviewed SQL and worker configuration."""
import html
import json
import secrets
from fastapi import FastAPI,Request,HTTPException
from fastapi.responses import HTMLResponse,PlainTextResponse
from config import ROOT,Settings
from clients import Database
from secrets_store import save_key

app=FastAPI(docs_url=None,redoc_url=None,openapi_url=None)
NONCE=secrets.token_urlsafe(32)

@app.middleware('http')
async def local_only(request:Request,call_next):
    if request.headers.get('host')!='127.0.0.1:8010' or request.client.host not in ('127.0.0.1','::1'):
        return PlainTextResponse('Loopback only',status_code=403)
    if request.method=='POST' and (request.headers.get('origin')!='http://127.0.0.1:8010' or request.headers.get('x-setup-token')!=NONCE):
        return PlainTextResponse('Invalid setup request',status_code=403)
    response=await call_next(request)
    response.headers['Cache-Control']='no-store'
    response.headers['X-Frame-Options']='DENY'
    return response

@app.get('/',response_class=HTMLResponse)
def index():
    return '''<!doctype html><html><head><title>Boses Bantay indexing setup</title></head><body style="font:18px system-ui;max-width:900px;margin:50px auto">
    <h1>Boses Bantay indexing setup</h1><p>This local page provides the reviewed, additive database migration. Existing source documents and legacy chunks are retained.</p>
    <button id="copy" onclick="copySql()">Copy migration SQL</button><p id="message"></p>
    <details><summary>Review migration</summary><pre id="sql" style="white-space:pre-wrap"></pre></details>
    <h2>Server-only worker credential</h2><p>Optional until automatic indexing is enabled. Use the existing Supabase secret/service-role key. It grants broad database access and is encrypted for your Windows account. It is never put in Expo or sent to a new external provider.</p>
    <label>Existing server key <input id="key" type="password" autocomplete="off" style="width:500px"></label>
    <button onclick="connect()">Encrypt key for local indexing worker</button><p id="result"></p>
    <script>
    async function copySql(){let sql=await(await fetch('/migration')).text();document.getElementById('sql').textContent=sql;await navigator.clipboard.writeText(sql);document.getElementById('message').textContent='Migration SQL copied. Run it in your Supabase SQL editor.'}
    async function connect(){let key=document.getElementById('key');let r=await fetch('/credential',{method:'POST',headers:{'Content-Type':'application/json','X-Setup-Token':TOKEN},body:JSON.stringify({key:key.value})});key.value='';document.getElementById('result').textContent=r.ok?'Worker credential encrypted successfully.': 'Connection failed; check the server key and migration.';}
    </script></body></html>'''.replace('TOKEN',json.dumps(NONCE))

@app.get('/migration',response_class=PlainTextResponse)
def migration(name:str='001_retrieval.sql'):
    if name not in {'001_retrieval.sql','002_search_tuning.sql','003_expired_jobs.sql','004_batched_publication.sql'}:
        raise HTTPException(404,'Unknown migration')
    return (ROOT/'migrations'/name).read_text(encoding='utf-8')

@app.post('/credential')
async def credential(request:Request):
    body=await request.json();key=body.get('key','').strip()
    if not key or len(key)>4096:
        raise HTTPException(400,'Invalid credential')
    db=Database(Settings.from_env(),key)
    # Worker-only function verifies actual permission without claiming a job.
    try:
        db.rpc('bb_job_heartbeat',{'p_job':-1,'p_lease':'00000000-0000-0000-0000-000000000000'})
    except Exception:
        raise HTTPException(400,'Worker authorization unavailable') from None
    save_key(key)
    return {'configured':True}
