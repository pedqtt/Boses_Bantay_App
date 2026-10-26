const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||process.cwd()),ts=require(path.join(root,'node_modules/typescript'));
function compile(name,context){const src=fs.readFileSync(path.join(root,'lib/api',name+'.ts'),'utf8');vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);return context.exports;}
function setup(env){
  const config=compile('speechBackend',{exports:{},process:{env}});
  const calls=[];let status=200,body={text:'Synthetic transcription.'};
  class Form {constructor(){this.parts=[]}append(...part){this.parts.push(part)}}
  class File {constructor(uri){this.uri=uri;this.exists=!uri.includes("missing");this.size=uri.includes("empty")?0:128;this.name="clip.m4a"}}
  const context={exports:{},AbortController,setTimeout,clearTimeout,FormData:Form,require(name){if(name==='expo-file-system')return {File};if(name==='@/lib/api/speechBackend')return config;throw Error(name)},
    fetch:async(url,options)=>{calls.push({url,options});return {ok:status===200,status,json:async()=>body}}};
  return {api:compile('transcribe',context),config,calls,setResponse:(s,b)=>{status=s;body=b}};
}
(async()=>{
 const test=setup({EXPO_PUBLIC_RAG_API_URL:'http://shared-test:8503/',EXPO_PUBLIC_RAG_API_KEY:'shared-key',EXPO_PUBLIC_WHISPER_API_URL:'http://old-offline.invalid',EXPO_PUBLIC_WHISPER_API_KEY:'old-key'});
 assert.equal((await test.api.transcribeVoiceReport('file:///clip.m4a','description')).text,'Synthetic transcription.');
 assert.equal(test.calls[0].url,'http://shared-test:8503/transcribe');assert.equal(test.calls[0].options.headers['X-API-Key'],'shared-key');
 assert.equal(test.calls[0].options.headers['Content-Type'],undefined);assert.equal(test.calls[0].options.body.parts[1][1],'description');
 for(const [status,body,phrase] of [[401,{},'API key'],[404,{},'Hindi updated'],[503,{},'Hindi pa handa'],[200,{text:''},'Walang narinig'],[200,{text:123},'Walang narinig']]){
  test.setResponse(status,body);await assert.rejects(test.api.transcribeVoiceReport('file:///clip.m4a'),new RegExp(phrase));
 }
 await assert.rejects(test.api.transcribeVoiceReport("file:///missing.m4a"),/Hindi makita/);
 await assert.rejects(test.api.transcribeVoiceReport("file:///empty.m4a"),/Hindi makita/);
 const missing=setup({});await assert.rejects(missing.api.transcribeVoiceReport('file:///clip.m4a'),/Hindi naka-configure/);assert.equal(missing.calls.length,0);
 const legacy=setup({EXPO_PUBLIC_WHISPER_API_URL:'http://explicit-legacy',EXPO_PUBLIC_WHISPER_API_KEY:'legacy-key'});
 await legacy.api.transcribeVoiceReport('file:///clip.wav');assert.equal(legacy.calls[0].url,'http://explicit-legacy/transcribe');
 console.log('Transcription client checks passed: shared address/key, multipart field, friendly failures, and no fake transcript fallback.');
})().catch(error=>{console.error(error);process.exitCode=1});
