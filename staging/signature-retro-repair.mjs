// One-off, revision-guarded staging data repair. No email/calendar/Tasks API calls.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {applySharedSignature} from '../.local-preview/signature-batch.js';
const base='https://networth-staging-staging.up.railway.app';
const backup=new URL('../.staging-private/backups/2026-10-04T03-24-44-432Z/crm.json',import.meta.url);
const original=JSON.parse(fs.readFileSync(backup,'utf8'));
const clientId='d9943f31-4380-4941-ac00-a4b49cc6153a',sourceId='65aa777f-5ac3-45bf-8ca0-e4de37aae29b',batchId='ce78565c-1692-4c94-bd24-11fe4762c973';
const targetIds=['e23291aa-1289-4cf3-8f3a-4b17f8a6a662','bb42f225-1e57-4b4c-9432-fc9226c6674b'];
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const hash=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
function repair(state){
 const c=state.clients.find(c=>c.id===clientId);assert.ok(c);
 const source=c.decisions.find(d=>d.id===sourceId);assert.equal(source.signatureBatchId,batchId);assert.ok(source.signed&&source.sent&&source.sms2010?.manual);assert.equal(source.sms2010.sentDate,'2026-09-10');
 for(const id of targetIds)assert.equal(c.decisions.find(d=>d.id===id)?.signatureBatchId,batchId);
 const next=applySharedSignature(c,sourceId,source);
 const changed=next.decisions.filter((d,i)=>hash(d)!==hash(c.decisions[i])).map(d=>d.id);
 assert.ok(changed.every(id=>targetIds.includes(id)));
 for(const id of targetIds){const d=next.decisions.find(d=>d.id===id);assert.ok(d.signed&&d.sent);assert.equal(d.sms2010.sentDate,source.sms2010.sentDate);}
 const result={...state,clients:state.clients.map(item=>item.id===clientId?next:item)};
 assert.deepEqual(repairAgain(next),next);
 return {state:result,changed};
 function repairAgain(client){return applySharedSignature(client,sourceId,source);}
}
const planned=repair(original.state);
assert.equal(planned.changed.length,2);
if(process.argv.includes('--verify-saved')){
 const actual=JSON.parse(fs.readFileSync(new URL('../.staging-private/backups/2026-10-04T03-26-07-487Z/crm.json',import.meta.url),'utf8'));
 assert.equal(actual.revision,878);
 for(const id of targetIds){const saved=actual.state.clients.find(c=>c.id===clientId).decisions.find(d=>d.id===id);assert.match(saved.sms2010.recordedAt,/^2026-10-04T03:25:/);planned.state.clients.find(c=>c.id===clientId).decisions.find(d=>d.id===id).sms2010.recordedAt=saved.sms2010.recordedAt;}
 assert.deepEqual(actual.state,planned.state);assert.equal(repair(actual.state).changed.length,0);
 const audit=new URL('../.staging-private/signature-retro-20261004.json',import.meta.url);const record=JSON.parse(fs.readFileSync(audit,'utf8'));
 fs.writeFileSync(audit,JSON.stringify({...record,status:'verified',afterRevision:878,canonicalAfterHash:hash(actual.state),verification:'Independent readback and full-state deep equality; JSONB key ordering ignored',externalSends:0},null,2));
 console.log(JSON.stringify({result:'PASS',updatedSignatures:2,revision:878,fullStateVerified:true,idempotent:true,externalSends:0}));process.exit(0);
}
if(!process.argv.includes('--apply')){console.log(JSON.stringify({mode:'dry-run',revision:original.revision,clients:1,signaturesToComplete:planned.changed.length,idempotent:true,externalSends:0}));process.exit(0);}
const config=JSON.parse(fs.readFileSync(new URL('../.staging-private/credentials.json',import.meta.url),'utf8'));
const request=(url,options={})=>fetch(base+url,{redirect:'manual',signal:AbortSignal.timeout(20000),...options});
const health=await request('/api/health');assert.equal(health.status,200);assert.equal((await health.json()).environment,'staging');
const unlock=await request('/__staging/unlock',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({key:config.STAGING_ACCESS_KEY})});assert.equal(unlock.status,302);
const cookie=unlock.headers.get('set-cookie').split(';')[0];
const login=await request('/__staging/session',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({role:'admin'})});assert.equal(login.status,200);
const token=JSON.parse((await login.text()).match(/setItem\('token',(.*?)\);/)[1]);
const headers={Cookie:cookie,Authorization:'Bearer '+token,Origin:base,'Content-Type':'application/json'};
const read=async()=>{const r=await request('/api/staging/crm',{headers});assert.equal(r.status,200);return r.json();};
const current=await read();
assert.equal(current.revision,original.revision,'State changed since backup; stop, inspect and back up again');
assert.equal(hash(current.state),hash(original.state),'Backup differs from current state');
const next=repair(current.state);
const audit=new URL('../.staging-private/signature-retro-20261004.json',import.meta.url);
fs.writeFileSync(audit,JSON.stringify({status:'prepared',beforeRevision:current.revision,backup:backup.pathname,clientId,sourceId,targetIds,beforeHash:hash(current.state),afterHash:hash(next.state)},null,2),{flag:'wx'});
const saved=await request('/api/staging/crm',{method:'PUT',headers,body:JSON.stringify({revision:current.revision,state:next.state})});assert.equal(saved.status,200,'No automatic retry on conflict');
const savedRevision=(await saved.json()).revision;
const verified=await read();assert.equal(verified.revision,savedRevision);assert.equal(hash(verified.state),hash(next.state));assert.equal(repair(verified.state).changed.length,0);
fs.writeFileSync(audit,JSON.stringify({status:'verified',beforeRevision:current.revision,afterRevision:savedRevision,clientId,sourceId,targetIds,beforeHash:hash(current.state),afterHash:hash(next.state),externalSends:0},null,2));
console.log(JSON.stringify({result:'PASS',updatedSignatures:next.changed.length,revision:savedRevision,idempotent:true,externalSends:0}));
