import { Failure } from './http.mjs';
export const MODEL_ID='BAAI/bge-m3@5617a9f61b028005a4858fdac845db406aefb181';
export class Database {
  constructor(env,fetcher=(...args)=>fetch(...args)) {
    this.url=env.SUPABASE_URL?.replace(/\/$/,'');this.key=env.SUPABASE_PUBLIC_KEY;this.fetcher=fetcher;
    if(!this.url?.startsWith('https://')||!this.key)throw new Failure('configuration');
    this.signal=AbortSignal.timeout(120000);
  }
  async rpc(name,body={}) {
    const stage=name==='bb_validate_sources'?'source_validation':'retrieval';
    const headers={'Content-Type':'application/json',apikey:this.key};
    if(!this.key.startsWith('sb_'))headers.Authorization=`Bearer ${this.key}`;
    try {
      const response=await this.fetcher(`${this.url}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.any([this.signal,AbortSignal.timeout(10000)])});
      if(!response.ok)throw new Failure(stage,`database_http_${response.status}`);return await response.json();
    }catch(error){throw error instanceof Failure?error:new Failure(stage,error?.name==='TypeError'?'database_runtime_type_error':'database_network_error');}
  }
  async catalogue() {
    const data=await this.rpc('bb_search_catalogue');
    if(!Number.isInteger(data?.approved)||!Number.isInteger(data?.indexed)||data.indexed>data.approved||!Array.isArray(data.titles))throw new Failure('retrieval','invalid_catalogue');
    return data;
  }
  async search(vector,query,count=24) {
    const limit=Math.max(1,Math.min(48,count));
    const rows=await this.rpc('bb_search_hybrid',{p_embedding:vector,p_query:query,p_model:MODEL_ID,p_count:limit});
    if(!Array.isArray(rows)||rows.length>limit || rows.some(r=>!Number.isSafeInteger(r.chunk_id)||!Number.isSafeInteger(r.document_id)||!Number.isSafeInteger(r.revision)||
      typeof r.content!=='string'||!r.content||typeof r.title!=='string'||typeof r.section_title!=='string'||!Number.isFinite(r.similarity)||r.similarity< -1.001||r.similarity>1.001))
      throw new Failure('retrieval','invalid_candidates');
    return rows;
  }
  async validate(rows) {
    return await this.rpc('bb_validate_sources',{p_sources:rows.map(r=>({chunk_id:r.chunk_id,revision:r.revision}))})===true;
  }
}
