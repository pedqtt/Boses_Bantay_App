"""Read-only smoke check. Uses existing local credentials, never prints keys."""
import json
import os
from pathlib import Path
import time
from dotenv import load_dotenv

if os.environ.get('BB_CITATION_TEST_ENV'):
    load_dotenv(Path(os.environ['BB_CITATION_TEST_ENV']),override=False)

import config
from supabase import create_client
from ollama import Client
from chat import retrieve, stream_passages
import chat
from citations import citation_errors
from guide_schema import GeneratedResponse

def main():
    config.validate_supabase()
    database=create_client(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY)
    class Counted:
        def __init__(self):
            self.client=Client(host=config.OLLAMA_HOST,timeout=180)
            self.embeddings=self.generations=0
        def embed(self,**kwargs):
            self.embeddings+=1
            return self.client.embed(**kwargs)
        def chat(self,**kwargs):
            self.generations+=1
            return self.client.chat(**kwargs)
    models=Counted()
    if os.environ.get('BB_CITATION_DIAGNOSTICS'):
        original=chat._draft_answer
        def checked(question,passages,models,feedback=None):
            raw=original(question,passages,models,feedback)
            try:
                value=GeneratedResponse.model_validate_json(raw)
                print(json.dumps({'kind':value.kind,'errors':citation_errors(value,passages),
                                  'declared':value.source_ids,'retrieved':[p.source_id for p in passages]},ensure_ascii=True),flush=True)
            except ValueError:
                print('Structured output did not parse.',flush=True)
            return raw
        chat._draft_answer=checked
    # Deliberately restricted to the known synthetic fixtures, never real policy.
    for question,language in [('What is the fictional clearance fee?','english'),
                              ('Magkano ang clearance sa fictional Barangay Halimbawa?','tagalog'),
                              ('Magkano ang deposit for the fictional multipurpose hall?','taglish')]:
        if os.environ.get('BB_CITATION_LANGUAGE') and language != os.environ['BB_CITATION_LANGUAGE']:
            continue
        started=time.perf_counter()
        before_e,before_g=models.embeddings,models.generations
        passages=retrieve(question,database,models)
        events=list(stream_passages(question,passages,models,language=language,response_mode='concise'))
        text=''.join(e.text for e in events)
        print(json.dumps(dict(question=question,language=language,answer=text,
             sources=[dict(filename=p.source,page=p.page) for p in events[-1].sources],
             embeddings=models.embeddings-before_e,generations=models.generations-before_g,
             seconds=round(time.perf_counter()-started,2)),ensure_ascii=True),flush=True)

if __name__=='__main__': main()
