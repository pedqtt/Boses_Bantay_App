"""Drop-in adapter for the existing authenticated /api/chat route."""
import os
import requests

class ChatUnavailable(Exception):
    pass

def answer_query(query,history=None):
    try:
        r=requests.post(os.getenv('BB_RETRIEVAL_URL','http://127.0.0.1:8003').rstrip('/')+'/answer',
                        json={'query':query,'history':history or []},timeout=(5,170))
        body=r.json()
        if r.status_code not in (200,503) or not isinstance(body.get('answer'),str):
            raise ValueError('invalid_response')
        # Existing route returns the structured response even for a retryable engine failure.
        body['citations']=body.get('sources',[])
        return body
    except (requests.RequestException,ValueError) as error:
        return {'answer':f'A technical connection issue prevented the document lookup for “{query[:220]}”. Please retry. You can also consult the original document or ask the document administrator.',
                'status':'service_failure','sources':[],'citations':[],'grounded':False,'retryable':True,'failureStage':'gateway'}
