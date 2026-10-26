const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/serviceComplaintFlow.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText, context);
const { COMPLAINT_STEPS, complaintCanAdvance: valid, complaintNext: next, complaintPrevious: back } = context.exports;
const empty = { category: null, location: '', description: '' };
const complete = { category: 'road', location: 'Purok 2', description: 'Sirang kalsada' };
assert.equal(valid('intro', empty), true);
assert.equal(valid('category', empty), false);
assert.equal(valid('category', { ...empty, category: 'road' }), true);
assert.equal(valid('details', { ...complete, location: '   ' }), false);
assert.equal(valid('details', { ...complete, description: '\n ' }), false);
assert.equal(valid('details', complete), true);
assert.equal(valid('photos', complete), true, 'photos remain optional');
assert.equal(valid('review', empty), false);
assert.equal(valid('review', complete), true);
let step = 'intro';
for (const expected of ['category', 'details', 'photos', 'review', 'review']) { step = next(step); assert.equal(step, expected); }
for (const expected of ['photos', 'details', 'category', 'intro', 'intro']) { step = back(step); assert.equal(step, expected); }
assert.deepEqual(complete, { category: 'road', location: 'Purok 2', description: 'Sirang kalsada' });
assert.equal(COMPLAINT_STEPS.length, 5);
console.log('Complaint flow checks passed: required fields, whitespace, optional photos, forward/back boundaries, review gating.');
