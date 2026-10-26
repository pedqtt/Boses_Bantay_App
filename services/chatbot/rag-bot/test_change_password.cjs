const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");
const root = path.resolve(__dirname, "../../..");
const source = fs.readFileSync(path.join(root, "lib/api/changePassword.ts"), "utf8");
function setup(options = {}) {
  const calls = { verified: 0, updated: 0, cleaned: 0 };
  const session = { id: "account-a", email: "account@mobile.user" };
  const verifier = { auth: {
    signInWithPassword: async () => { calls.verified++; return { data: { user: { id: options.verifiedOwner || session.id } }, error: options.verifyError || null }; },
    updateUser: async attributes => { calls.updated++; assert.equal(attributes.current_password, "ExistingPass123!"); assert.equal(attributes.password, "NewSecurePass456!"); return { data: { user: session }, error: options.updateError || null }; },
    signOut: async () => { calls.cleaned++; return { error: null }; },
  } };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, process: { env: { EXPO_PUBLIC_SUPABASE_URL: "https://example.invalid", EXPO_PUBLIC_SUPABASE_ANON_KEY: "public-test-key" } },
    require: name => name === "@supabase/supabase-js" ? { createClient: (_url, _key, config) => { assert.equal(config.auth.persistSession, false); return verifier; } } : name === "@/lib/supabase" ? { isSupabaseConfigured: true, supabase: { auth: { getUser: async () => ({ data: { user: session }, error: null }) } } } : { getNewPasswordError: value => value ? null : "Missing password" },
  });
  return { change: exports.changeAccountPassword, calls };
}
(async () => {
  let test = setup();
  await test.change("account-a", "ExistingPass123!", "NewSecurePass456!");
  assert.deepEqual(test.calls, { verified: 1, updated: 1, cleaned: 1 });
  test = setup({ verifyError: { code: "invalid_credentials" } });
  await assert.rejects(() => test.change("account-a", "ExistingPass123!", "NewSecurePass456!"), /kasalukuyang password/);
  assert.equal(test.calls.updated, 0); assert.equal(test.calls.cleaned, 1);
  test = setup();
  await assert.rejects(() => test.change("account-b", "ExistingPass123!", "NewSecurePass456!"), /Mag-sign in muli/);
  assert.equal(test.calls.verified, 0); assert.equal(test.calls.updated, 0);
  test = setup({ verifiedOwner: "account-b" });
  await assert.rejects(() => test.change("account-a", "ExistingPass123!", "NewSecurePass456!"), /Hindi tugma/);
  assert.equal(test.calls.updated, 0); assert.equal(test.calls.cleaned, 1);
  test = setup({ updateError: { code: "weak_password" } });
  await assert.rejects(() => test.change("account-a", "ExistingPass123!", "NewSecurePass456!"), /lakas ng password/);
  assert.equal(test.calls.cleaned, 1);
  test = setup();
  await assert.rejects(() => test.change("account-a", "ExistingPass123!", "ExistingPass123!"), /iba sa kasalukuyan/);
  assert.equal(test.calls.updated, 0);
  console.log("Six mocked password-change cases passed; no live credentials or accounts used.");
})().catch(error => { console.error(error); process.exit(1); });
