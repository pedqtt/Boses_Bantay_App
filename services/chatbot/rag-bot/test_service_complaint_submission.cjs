const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const context = { exports: {}, console: { warn() {} } };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/api/serviceComplaintSubmission.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { buildServiceComplaintRow: build, insertServiceComplaint: save } = context.exports;
const input = { referenceNo:'TEST-ONLY', userId:'synthetic-user', category:{ value:'road',label:'Sirang Kalsada' }, location:' Purok 2 ',description:' Sirang kalsada ',photoPaths:['synthetic-user/photo.jpg'] };
const row = build(input);
assert.equal(row.location,'Purok 2');assert.equal(row.description,'Sirang kalsada');assert.equal(row.full_details.type,'service_complaint');
const schema = new Set(['reference_no','user_id','status','category','summary','description','location','full_details']);
for(const column of Object.keys(row)) assert(schema.has(column));
assert.equal(row.incident_category,undefined);assert.equal(row.incident_location_text,undefined);
assert.throws(()=>build({ ...input,description:'   ' }));
assert.throws(()=>build({ ...input,photoPaths:Array(6).fill('photo') }));
function client(result) { return { from(table) { assert.equal(table,'reports'); return { insert(payload) { assert.equal(payload.user_id,input.userId); return { select(fields) { assert.equal(fields,'id,reference_no'); return { single:async()=>result }; } }; } }; } }; }
(async()=>{
 assert.equal((await save(client({ data:{id:'synthetic-id',reference_no:'TEST-ONLY'},error:null }),input)).id,'synthetic-id');
 for(const result of [{data:null,error:{code:'42501',message:'denied'}},{data:null,error:null},{data:{id:'x',reference_no:'wrong'},error:null}]) await assert.rejects(save(client(result),input));
 console.log('Complaint database checks passed: verified live column names, fields/photo paths preserved, confirmed receipt required, denied/unconfirmed writes fail. No live records inserted.');
})().catch(error=>{console.error(error);process.exitCode=1;});
