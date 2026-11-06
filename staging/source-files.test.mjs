import test from 'node:test';
import assert from 'node:assert/strict';
import {createFiles,sourceMetadata,MAX_SOURCE_BYTES} from './files.mjs';
import {mergeSourceProfile} from '../.local-preview/source-profile.js';
import {policyDisplay,providerLogo,providerOptions} from '../frontend/src/lib/crmDisplay.js';
import {processDocuments} from '../.local-preview/process-documents.js';
function response(){return {code:200,headers:{},status(v){this.code=v;return this;},json(v){this.body=v;return this;},send(v){this.body=v;return this;},sendStatus(v){this.code=v;return this;},set(k,v){this.headers[k]=v;return this;}};}
function store(){
 const rows=[];return {rows,pool:{async query(sql,args){
  if(sql.startsWith('SELECT state'))return {rows:[{state:{clients:[{id:args[0]==='owner-a'?'client-a':'client-b'}]}}]};
  if(sql.startsWith('INSERT')){const [owner_id,client_id,id,source,name,mime,bytes,size,sha256]=args;let row=rows.find(r=>r.owner_id===owner_id&&r.client_id===client_id&&r.source===source&&r.sha256===sha256);if(!row){row={owner_id,client_id,id,source,name,mime,bytes,size,sha256,created_at:'2026-09-30'};rows.push(row);}return {rows:[row]};}
  return {rows:rows.filter(r=>r.owner_id===args[0]&&r.id===args[1])};
 }}};
}
const bytes=Buffer.from('<Root>synthetic report</Root>');
const request=(owner='owner-a',clientId='client-a')=>({user:{id:owner},query:{clientId,source:'maslaka'},get:()=>encodeURIComponent('מקור.xml'),body:bytes});
test('original file roundtrip, hash, private metadata and idempotent same-owner retry',async()=>{
 const db=store(),api=createFiles(db),first=response();await api.create(request(),first);assert.equal(first.code,201);assert.equal(first.body.size,bytes.length);assert.equal(first.body.bytes,undefined);
 const again=response();await api.create(request(),again);assert.equal(again.body.id,first.body.id);assert.equal(db.rows.length,1);
 const out=response();await api.read({user:{id:'owner-a'},params:{id:first.body.id}},out);assert.deepEqual(out.body,bytes);assert.equal(out.headers['Cache-Control'],'no-store');assert.match(out.headers['Content-Disposition'],/^attachment/);
});
test('cross-owner access, foreign client association and invalid id fail closed',async()=>{
 const db=store(),api=createFiles(db),first=response();await api.create(request(),first);
 const out=response();await api.read({user:{id:'owner-b'},params:{id:first.body.id}},out);assert.equal(out.code,404);
 const foreign=response();await api.create(request('owner-b','client-a'),foreign);assert.equal(foreign.code,404);
 const bad=response();await api.read({user:{id:'owner-a'},params:{id:'------------------------------------'}},bad);assert.equal(bad.code,404);
 assert.equal(db.rows.length,1);
});
test('wrong source, disguised content, traversal, missing and oversized files rejected',()=>{
 for(const item of [{name:'../secret.xml',source:'maslaka',bytes},{name:'x.exe',source:'maslaka',bytes},{name:'x.zip',source:'maslaka',bytes},{name:'x.xml',source:'har_bituach',bytes},{name:'x.xml',source:'maslaka',bytes:Buffer.alloc(0)},{name:'x.xml',source:'maslaka',bytes:Buffer.alloc(MAX_SOURCE_BYTES+1)}])assert.throws(()=>sourceMetadata(item),/file_invalid/);
 assert.equal(sourceMetadata({name:'test.xml',source:'maslaka',bytes}).sha256.length,64);
});
const report={id:'r1',source:'maslaka',fingerprint:'hash-1',asOf:'2026-08-31',customerProfile:{name:'שם מהמסלקה',identity:'012345678',birth:'2000-01-02',conflicts:[]},customerEmails:['synthetic@example.invalid']};
test('clearinghouse profile is authoritative, preserves prior values and repeated import is idempotent',()=>{
 const client={name:'שם ליד',identity:'012345678',birth:'',email:'',products:[],reports:[]};
 const imported=mergeSourceProfile(client,[report]);assert.equal(imported.name,report.customerProfile.name);assert.equal(imported.email,report.customerEmails[0]);assert.equal(imported.sourceProfileHistory[0].name,client.name);
 const saved={...imported,reports:[report]};assert.equal(mergeSourceProfile(saved,[{...report,id:'retry-id'}]),saved);
 const older={...report,id:'older',asOf:'2025-01-01',customerEmails:['older@example.invalid']};assert.equal(mergeSourceProfile(saved,[older]),saved);
});
test('contradictory latest report values do not pick an arbitrary customer email/name',()=>{
 const conflicting={...report,id:'other',fingerprint:'other',customerProfile:{...report.customerProfile,name:'שם שונה'},customerEmails:['other@example.invalid']};
 const result=mergeSourceProfile({name:'שם לבדיקה',reports:[]},[report,conflicting]);assert.equal(result.name,'שם לבדיקה');assert.equal(result.email,'');assert.ok(result.sourceProfile.conflicts.includes('שם'));assert.ok(result.sourceProfile.conflicts.includes('מייל'));
 const sequential=mergeSourceProfile({...mergeSourceProfile({name:'שם קודם',reports:[]},[report]),reports:[report]},[conflicting]);assert.equal(sequential.email,'');assert.ok(sequential.sourceProfile.conflicts.includes('שם'));
});
test('missing email does not erase an existing value, newest report timestamp wins over stale profile',()=>{
 const client={email:'retained@example.invalid',emailSource:'פרטי התיק',reports:[],name:'Existing'};
 const missing={...report,customerEmails:[]};assert.equal(mergeSourceProfile(client,[missing]).email,client.email);
 const stale={...client,sourceProfile:{asOf:'2020-01-01'},reports:[{...report,asOf:'2026-09-01'}]};assert.equal(mergeSourceProfile(stale,[report]),stale);
});
test('display removes excess padding only, preserves nine-digit IDs and provider aliases resolve',()=>{
 assert.equal(policyDisplay('0000000322460841'),'322460841');assert.equal(policyDisplay('0000000012345678'),'012345678');assert.equal(policyDisplay('012345678'),'012345678');assert.equal(policyDisplay('7-913-630055-0'),'7-913-630055-0');
 assert.match(providerLogo('מגדל מקפת קרנות פנסיה וקופות גמל בע"מ'),/migdal/);assert.ok(providerOptions('ביטוח חיים').includes('מגדל'));assert.ok(providerOptions('פנסיה').includes('אלטשולר שחם'));
});
test('process archive exposes earlier payroll/transfer docs once and rejects active URL payloads',()=>{
 const doc={name:'same.txt',data:'data:text/plain;charset=utf-8,synthetic'},other={name:'bad.html',data:'javascript:alert(1)'};
 const docs=processDocuments({policyDocument:doc,transfer:{annex:doc,cubes:{name:'cubes.txt',data:'data:text/plain,other'},document:doc},correctionDocument:other});
 assert.equal(docs.length,2);assert.match(docs[0].label,/נספח/);assert.match(docs[0].label,/ניוד/);
});
