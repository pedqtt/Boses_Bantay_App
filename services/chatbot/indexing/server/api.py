"""Private retrieval API; the existing authenticated Whisper API is its gateway."""
from fastapi import FastAPI,HTTPException
from fastapi.responses import JSONResponse
from engine import Engine
from schemas import ChatRequest
import requests

app=FastAPI(title='Boses Bantay retrieval engine')
engine=Engine()

@app.get('/health')
def health():
    try:
        catalogue=engine.db.catalogue()
        models=requests.get(engine.settings.inference_url+'/health',timeout=(3,5)).json()
        ready=catalogue['indexed']==catalogue['approved'] and models.get('ready') is True
        return JSONResponse({'ready':ready,'catalogue':catalogue,'models':models,
                'embedding_model':engine.settings.embedding_model},status_code=200 if ready else 503)
    except Exception:
        return JSONResponse({'ready':False,'stage':'retrieval'},status_code=503)

@app.post('/answer')
def answer(request:ChatRequest):
    if not request.query.strip():
        raise HTTPException(422,'Question cannot be blank')
    result=engine.answer(request.query.strip(),[t.model_dump() for t in request.history])
    return JSONResponse(result,status_code=503 if result['status']=='service_failure' else 200)
