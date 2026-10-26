const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: name => dependencies[name], console: { log() {} } });
  return exports;
}
const validation = load('lib/validation.ts');
const calls = {};
let row;
const supabase = {
  auth: {
    signUp: async input => { calls.metadata = input.options.data; return { data: { user: { id: 'test-user' } }, error: null }; },
    signInWithPassword: async () => ({ error: null }),
  },
  from: () => ({
    upsert: async input => { calls.row = input; return { error: null }; },
    select: () => ({ eq: () => ({ count: 0, error: null, maybeSingle: async () => ({ data: row, error: null }) }) }),
  }),
};
const auth = load('lib/api/auth.ts', { '@/lib/supabase': { supabase, isSupabaseConfigured: true }, '@/lib/validation': validation });
(async () => {
  assert.equal(validation.getMiddleNameError(''), null);
  assert.equal(validation.getMiddleNameError('D.'), null);
  assert.equal(validation.getMiddleNameError('De la Peña'), null);
  assert.ok(validation.getMiddleNameError('123'));
  for (const [index, middleName] of ['  Santos  ', undefined].entries()) {
    const phone = `0917000000${index}`;
    await auth.signUpUser({ phone, password: 'TestPass123!', firstName: 'Juan', middleName, lastName: 'Cruz' });
    const result = await auth.verifyPhoneCode(phone, auth.MOCK_OTP);
    assert.equal(result.profile.fullName, index === 0 ? 'Juan Santos Cruz' : 'Juan Cruz');
    assert.equal(calls.metadata.middle_name, index === 0 ? 'Santos' : null);
    assert.equal(calls.row.middle_name, index === 0 ? 'Santos' : null);
  }
  for (const middle_name of ['Santos', null, undefined]) {
    row = { id: 'test-user', first_name: 'Juan', middle_name, last_name: 'Cruz' };
    const result = await auth.logInUser('09170000000', 'TestPass123!');
    assert.equal(result.profile.fullName, middle_name ? 'Juan Santos Cruz' : 'Juan Cruz');
  }
  console.log('Middle-name validation, signup persistence and legacy login cases passed (mocked, no accounts created).');
})().catch(error => { console.error(error); process.exitCode = 1; });
