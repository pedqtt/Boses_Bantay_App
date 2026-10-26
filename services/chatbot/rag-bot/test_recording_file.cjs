const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const output = ts.transpileModule(fs.readFileSync('lib/api/recordingFile.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
async function run(mode) {
  let finish, saved = false, copied = false;
  class File {
    constructor(...parts) { this.uri = parts.join('/'); this.source = this.uri === 'source'; }
    get exists() { return this.source || saved; }
    get size() { return this.source ? 128 : saved ? (mode === 'truncated' ? 64 : 128) : 0; }
    copy() { copied = true; return new Promise((resolve, reject) => { finish = () => { if (mode === 'failure') reject(new Error('copy failed')); else { saved = true; resolve(); } }; }); }
  }
  const context = { exports: {}, require: () => ({ File, Paths: { document: 'documents' } }) };
  vm.runInNewContext(output, context);
  let settled = false;
  const result = context.exports.saveRecordedClip('source').finally(() => { settled = true; });
  await Promise.resolve();
  assert(copied); assert.equal(settled, false, 'must wait for copy before returning upload URI');
  finish();
  if (mode === 'failure') await assert.rejects(result, /copy failed/);
  else if (mode === 'truncated') await assert.rejects(result, /Hindi kumpleto/);
  else assert.match(await result, /^documents\/report-.*\.m4a$/);
}
(async () => { for (const mode of ['success', 'failure', 'truncated']) await run(mode); console.log('Audio copy regression checks passed: delayed copy, failed copy, truncated copy.'); })().catch(error => { console.error(error); process.exitCode = 1; });
