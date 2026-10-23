import { Failure,bounded } from './http.mjs';
import { probes } from './embedding-probes.mjs';
import { parseStructured } from './schemas.mjs';
import { POLICY,SCOPE,scopeSchema } from './policy.mjs';

export const EMBED_MODEL='@cf/baai/bge-m3';
let compatibleUntil=0,compatibilityPromise=null;
export function normalize(vector) {
  if(!Array.isArray(vector)||vector.length!==1024||vector.some(n=>typeof n!=='number'||!Number.isFinite(n)))throw new Failure('embedding','invalid_embedding');
  const magnitude=Math.hypot(...vector);
  if(magnitude<1e-8)throw new Failure('embedding','zero_embedding');
  return vector.map(n=>n/magnitude);
}
function expected(encoded) {
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));const view=new DataView(bytes.buffer);
  return Array.from({length:1024},(_,i)=>view.getFloat32(i*4,true));
}
export function cosine(a,b) { return a.reduce((total,value,i)=>total+value*b[i],0)/(Math.hypot(...a)*Math.hypot(...b)); }

export class Models {
  constructor(env) {
    this.ai=env.AI;this.model=env.CHAT_MODEL||'@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    this.controlModel=env.CONTROL_MODEL||'@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    this.reviewModel=env.REVIEW_MODEL||this.controlModel;
    if(!this.ai?.run)throw new Failure('configuration');
  }
  async vectors(texts) {
    const result=await bounded(this.ai.run(EMBED_MODEL,{text:texts,pooling:'cls',truncate_inputs:false}),'embedding');
    const vectors=result?.data;
    if(!Array.isArray(vectors)||vectors.length!==texts.length)throw new Failure('embedding','invalid_embedding_contract');
    return vectors.map(normalize);
  }
  async checkCompatibility() {
    if(compatibleUntil>Date.now())return;
    if(!compatibilityPromise)compatibilityPromise=(async()=>{
      const vectors=await this.vectors(probes.map(p=>p.text));
      const scores=vectors.map((v,i)=>cosine(v,expected(probes[i].expected)));
      if(scores.some(s=>s<.995))throw new Failure('embedding','incompatible_embedding_model');
      compatibleUntil=Date.now()+3600000;
    })().finally(()=>{compatibilityPromise=null;});
    await compatibilityPromise;
  }
  async embed(query) { await this.checkCompatibility();return (await this.vectors([query]))[0]; }
  async scope(query,history) {return this.structured(SCOPE,{question:query,history:history.slice(-6)},scopeSchema,'scope');}
  async structured(system,payload,schema,stage='generation') {
    // Include the schema in both the prompt and structured-output setting.
    const model=stage==='generation'?this.model:stage==='verification'?this.reviewModel:this.controlModel;
    const completion=model==='@cf/qwen/qwen3.8-27b';
    const options={
      messages:[{role:'system',content:POLICY+'\n\n'+system},{role:'user',content:'Output schema:\n'+JSON.stringify(schema)+'\nInput data:\n'+JSON.stringify(payload)}],
      response_format:{type:'json_schema',json_schema:completion?{name:'barangay_response',schema,strict:true}:schema},
      temperature:stage==='generation'?.3:0,stream:false
    };
    if(completion){options.chat_template_kwargs={enable_thinking:false,preserve_thinking:false};options.max_completion_tokens=3072;options.store=false;}
    else options.max_tokens=stage==='scope'?650:stage==='verification'?1000:2400;
    const result=await bounded(this.ai.run(model,options),stage,45000);
    const message=completion?result?.choices?.[0]?.message:null;
    if(completion&&(result?.choices?.[0]?.finish_reason!=='stop'||message?.tool_calls?.length))throw new Failure(stage,'incomplete_model_output');
    try{return parseStructured(completion?message?.content:result?.response,schema);}catch{throw new Failure(stage,'invalid_model_output');}
  }
}
