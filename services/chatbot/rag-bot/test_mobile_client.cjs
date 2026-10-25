// Test the actual TypeScript transport without importing a React Native runtime.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(process.argv[2] || process.cwd());
const ts = require(path.join(root, 'node_modules/typescript'));
const source = fs.readFileSync(path.join(root,'lib/api/chat.ts'),'utf8');
const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const kb = JSON.parse(fs.readFileSync(path.join(root,'services/chatbot/rag-bot/menu_kb.json'),'utf8'));
const calls=[];
const token='a'.repeat(32)+'.'+'b'.repeat(64);
let next={answer:'Test fact [1].',sources:[{id:1,documentTitle:'guide.pdf',section:'page 2'}],suggestions:kb.categories.map(c=>c.name.english)};
const context={exports:{}, require:()=>kb, process:{env:{EXPO_PUBLIC_RAG_API_URL:'http://test/',EXPO_PUBLIC_RAG_API_KEY:'test'}},
  AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.endsWith('/api/session')?{session_id:token}:next};}};
vm.runInNewContext(js,context);
(async()=>{
  const api=context.exports;
  assert.equal(api.CHAT_CATEGORIES.length,6);
  assert.equal(api.CHAT_GREETING,kb.greeting);
  const id=await api.createBotSession(); assert.equal(id,token);
  const reply=await api.sendBotMessage('magkano?',id);
  assert.equal(reply.citations[0].documentTitle,'guide.pdf'); assert.equal(reply.suggestions.length,6);
  const body=JSON.parse(calls[1].options.body);
  assert.equal(body.session_id,token); assert.equal(body.query,'magkano?'); assert.equal(body.history,undefined);
  next={answer:'Please retry',retryable:true,status:'service_failure'};
  assert.equal((await api.sendBotMessage('question',id)).retryable,true);
  next={}; await assert.rejects(api.sendBotMessage('question',id));
  console.log('Mobile client transport checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
