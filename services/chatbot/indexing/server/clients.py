import math
import requests
from errors import PipelineFailure


class Models:
    def __init__(self, settings):
        self.settings=settings

    def call(self, operation, payload):
        try:
            response=requests.post(self.settings.inference_url+'/'+operation,json=payload,
                                   timeout=(5,self.settings.model_timeout))
            if response.status_code==422:
                detail=response.json().get('detail',{})
                if isinstance(detail,dict) and detail.get('code')=='generation_context_exceeded':
                    raise PipelineFailure('context','generation_context_exceeded',False)
            response.raise_for_status()
            return response.json()
        except (requests.RequestException,ValueError) as error:
            raise PipelineFailure(operation) from error

    def embed(self,texts):
        result=self.call('embed',{'texts':texts,'model_id':self.settings.embedding_model})
        vectors=result.get('embeddings',[])
        if result.get('model_id')!=self.settings.embedding_model or len(vectors)!=len(texts) or any(
            len(v)!=self.settings.embedding_dimensions or not all(isinstance(x,(float,int)) and math.isfinite(x) for x in v)
            for v in vectors):
            raise PipelineFailure('embed','invalid_contract')
        return vectors


class Database:
    def __init__(self,settings,key=None):
        self.settings=settings
        self.key=key or settings.public_key

    def rpc(self,name,payload=None):
        headers={'apikey':self.key}
        if not self.key.startswith(('sb_publishable_','sb_secret_')):
            headers['Authorization']='Bearer '+self.key
        try:
            r=requests.post(self.settings.database_url+'/rest/v1/rpc/'+name,json=payload or {},headers=headers,timeout=(5,30))
            r.raise_for_status()
            return r.json() if r.content else None
        except (requests.RequestException,ValueError) as error:
            raise PipelineFailure('retrieval' if name.startswith(('bb_search','bb_validate')) else 'indexing') from error

    def search(self,vector,query):
        rows=self.rpc('bb_search_hybrid',{'p_embedding':vector,'p_query':query,
                      'p_model':self.settings.embedding_model,'p_count':self.settings.candidate_count})
        if not isinstance(rows,list):
            raise PipelineFailure('retrieval','invalid_contract')
        return rows

    def catalogue(self):
        return self.rpc('bb_search_catalogue')

    def validate(self,rows):
        return self.rpc('bb_validate_sources',{'p_sources':[{'chunk_id':r['chunk_id'],'revision':r['revision']} for r in rows]}) is True
