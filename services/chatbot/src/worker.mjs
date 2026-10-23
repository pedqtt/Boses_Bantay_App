import { Database } from './database.mjs';
import { Models } from './provider.mjs';
import { answer,fallback } from './agent.mjs';
import { json,sameSecret,readInput } from './http.mjs';

function settings(env) {
  const minimum=Number(env.MIN_SIMILARITY??.40);
  if(!Number.isFinite(minimum)||minimum<0||minimum>1)throw new Error('invalid_thresholds');
  return {minimum};
}
export default {
  async fetch(request,env) {
    const path=new URL(request.url).pathname;
    if(path==='/health'&&request.method==='GET') {
      try {
        const db=new Database(env),models=new Models(env);settings(env);
        const catalogue=await db.catalogue();
        const ready=Boolean(env.CHAT_API_KEY)&&catalogue.indexed>0;
        return json({ready,mode:'hosted-supabase-rag',indexed:catalogue.indexed,approved:catalogue.approved,aiConfigured:Boolean(models.ai)},ready?200:503);
      }catch(error){return json({ready:false,mode:'hosted-supabase-rag',failureCode:error?.message?.match(/^[a-z0-9_]+$/)?.[0]||'unavailable'},503);}
    }
    if(path!=='/api/chat')return json({error:'Not found.'},404);
    if(request.method!=='POST')return json({error:'Use POST.'},405,{Allow:'POST'});
    if(!env.CHAT_API_KEY)return json(fallback('your question','service_failure',{},'configuration'),503);
    if(!await sameSecret(request.headers.get('X-API-Key'),env.CHAT_API_KEY))return json({error:'Unauthorized.'},401);
    if(env.CHAT_RATE_LIMITER) {
      try {
        const {success}=await env.CHAT_RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'});
        if(!success)return json(fallback('your question','service_failure',{},'capacity'),503,{'Retry-After':'60'});
      }catch{return json(fallback('your question','service_failure',{},'capacity'),503,{'Retry-After':'60'});}
    }
    let input;try{input=await readInput(request);}catch{input=null;}
    if(!input)return json({error:'Enter a question between 1 and 1,200 characters with a valid conversation history.'},400);
    let result;
    try{result=await answer(input.query,input.history,{db:new Database(env),models:new Models(env),...settings(env)});}
    catch{result=fallback(input.query,'service_failure',{},'configuration');}
    return json(result,result.status==='service_failure'?503:200);
  }
};
