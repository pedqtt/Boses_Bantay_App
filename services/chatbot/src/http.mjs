export class Failure extends Error {
  constructor(stage,code='unavailable') { super(code);this.stage=stage; }
}
export function json(body,status=200,headers={}) {
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
}
export async function sameSecret(actual,expected) {
  if(typeof actual!=='string' || !expected)return false;
  const encoder=new TextEncoder();
  const [a,b]=await Promise.all([actual,expected].map(s=>crypto.subtle.digest('SHA-256',encoder.encode(s))));
  const left=new Uint8Array(a),right=new Uint8Array(b);let mismatch=0;
  for(let i=0;i<left.length;i++)mismatch|=left[i]^right[i];
  return mismatch===0;
}
export async function bounded(promise,stage,ms=20000) {
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Failure(stage,'timeout')),ms);})]);}
  catch(error){throw error instanceof Failure?error:new Failure(stage);}
  finally{clearTimeout(timer);}
}
export async function readInput(request) {
  const reader=request.body?.getReader();if(!reader)return null;
  const parts=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>12000){await reader.cancel();return null;}parts.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  try {
    const body=JSON.parse(new TextDecoder().decode(bytes));
    if(typeof body?.query!=='string' || !body.query.trim() || body.query.length>1200)return null;
    if(body.history!==undefined && (!Array.isArray(body.history)||body.history.length>6))return null;
    const history=(body.history||[]).filter(t=>['user','assistant'].includes(t?.role) && typeof t.content==='string').slice(-6).map(t=>({role:t.role,content:t.content.slice(0,1200)}));
    return {query:body.query.trim(),history};
  }catch{return null;}
}
