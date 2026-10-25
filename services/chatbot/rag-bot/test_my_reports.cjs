const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function compile(path,requireFn){const ctx={exports:{},console:{warn(){}},require:requireFn};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,ctx);return ctx.exports;}
const model=compile('lib/myReports.ts',()=>({KNOWN_STATUSES:['Under Review','Forwarded','Investigating','Resolved','CFA Issued']}));
const api=compile('lib/api/myReports.ts',()=>model);
const user='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const row={id:'owned',complaint_id:12,blotter_id:13,user_id:user,reference_no:'TEST',created_at:'2026-10-25T05:00:00Z',status:'Under Review',full_details:{type:'service_complaint',photoPaths:['a','b']}};
assert(model.mapAccountReport(row,'reports',user).createdByMe);
assert.equal(model.mapAccountReport({...row,user_id:other},'reports',user),null);
assert.equal(model.mapAccountReport({...row,user_id:other,assigned_to:user},'reports',user),null,'reports has no assignment column');
const assigned=model.mapAccountReport({...row,user_id:other,assigned_to:user},'service_complaints',user);
assert(assigned.assignedToMe);assert.equal(assigned.createdByMe,false);
assert.equal(model.mapAccountReport({...row,user_id:other,assigned_to:other},'service_complaints',user),null);
assert.equal(model.mapAccountReport({...row,status:'Needs clarification'},'reports',user).status,'Needs clarification');
assert.equal(model.isClosedReport('Needs clarification'),false);assert.equal(model.isClosedReport('Resolved'),true);
assert.equal(model.mapAccountReport(row,'reports',user).photoCount,2);
assert.match(model.reportNextStep({...assigned,status:'Under Review'}),/Nakatalaga/);
let filters=[];
const client={from(source){return{select(){const query={eq(key,id){filters.push([source,'eq',key,id]);return query},or(value){filters.push([source,'or',value]);return query},async order(){return{data:[row,{...row,user_id:other,assigned_to:other,id:'unrelated'}],error:null}}};return query;}}}};
(async()=>{const result=await api.fetchAccountReports(client,user);assert.equal(result.reports.length,3);assert(result.reports.every(r=>r.createdByMe||r.assignedToMe));assert.equal(filters.filter(f=>f[1]==='eq').length,2);assert.equal(filters.find(f=>f[0]==='service_complaints')[2],`user_id.eq.${user},assigned_to.eq.${user}`);assert.throws(()=>api.scopeAccountQuery({},'reports','bad,filter'));console.log('My Reports checks passed: owner/assignee scope, unrelated records excluded, source filters, unknown statuses, photo counts, no samples.');})().catch(error=>{console.error(error);process.exitCode=1});
