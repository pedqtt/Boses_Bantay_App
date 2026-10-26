const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const disk = new Map(); let failWrites = false;
const secure = {
  getItemAsync: async key => disk.get(key) ?? null,
  setItemAsync: async (key, value) => { if (failWrites) throw Error('simulated storage interruption'); assert(Buffer.byteLength(value) <= 2048); disk.set(key, value); },
  deleteItemAsync: async key => { disk.delete(key); }
};
function fresh() {
 const context = { exports: {}, require: name => {
   if(name === 'expo-secure-store') return secure;
   if(name === '@/lib/serviceComplaintFlow') return { COMPLAINT_STEPS: ['intro','category','details','photos','review'] };
   throw Error(name);
 }};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/api/serviceComplaintDraft.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
 return context.exports;
}
(async () => {
 let store = fresh();
 const draft = { step: 'photos', categoryId: 'road', location: 'Purok 2', description: 'Detalye '.repeat(700), images: ['file:///old.jpg'], voiceDraft: { clips: ['file:///voice.m4a'] }, pendingPhoto: { replaceUri: 'file:///old.jpg' } };
 await store.saveComplaintDraft('user-a', draft);
 store = fresh(); // Native camera destroyed the JS process: only encrypted disk remains.
 const restored = await store.loadComplaintDraft('user-a');
 assert.equal(restored.description, draft.description); assert.equal(restored.step,'photos');
 assert.equal(restored.pendingPhoto.replaceUri,'file:///old.jpg'); assert.equal(restored.voiceDraft.clips[0], 'file:///voice.m4a');
 assert.equal(await store.loadComplaintDraft('user-b'), null);
 failWrites = true; await assert.rejects(store.saveComplaintDraft('user-a',{ ...draft, description:'bad checkpoint' })); failWrites = false;
 assert.equal((await store.loadComplaintDraft('user-a')).description, draft.description);
 const recovered = { ...draft, images:['file:///recovered.jpg'], pendingPhoto:null };
 await Promise.all([store.saveComplaintDraft('user-a', draft), store.saveComplaintDraft('user-a',recovered)]);
 assert.equal((await fresh().loadComplaintDraft('user-a')).images[0], 'file:///recovered.jpg');
 assert.equal((await fresh().loadComplaintDraft('user-a')).pendingPhoto,null);
 await store.clearComplaintDraft('user-a'); assert.equal(await fresh().loadComplaintDraft('user-a'),null);
 console.log('Camera draft checks passed: restart recovery, replacement target, voice retention, account isolation, interrupted writes, serialized saves, discard.');
})().catch(error => { console.error(error); process.exitCode=1; });
