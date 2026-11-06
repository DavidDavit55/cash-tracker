import test from 'node:test';
import assert from 'node:assert/strict';
import {hasFeeChange,feeAgreementPending,recordFeeChangeAgreement} from '../.local-preview/fee-change-agreement.js';
import {changeRequests,recordAppointmentCheck,recordChangeCheck,changeWorkflowReady} from '../.local-preview/agent-change-rules.js';
import {homeTasks} from '../.local-preview/workflow-home-model.js';
import {agreedChanges} from '../.local-preview/workflow-detail-rules.js';
import {buildSummary,completeDecision} from '../.local-preview/workflow-model.js';
import {recordExternalKit} from '../.local-preview/workflow-process.js';
import {operationalProjection} from './tasks.mjs';
const action='מינוי סוכן וביצוע השינויים שבסיכום';
const pending={id:'d',productId:'p',productCategory:'השתלמות',action,track:'מניות',depositFee:0,balanceFee:0.4,signatureSent:true,signatureSentAt:'2026-01-01',signatureMessageSentAt:'2026-01-01',feeChangeRequested:false};
const client=d=>({id:'c',name:'בדיקה',call:'yes',products:[{id:'p',category:'השתלמות',balanceFee:0.6,depositFee:0,premium:20}],decisions:[d]});
const signed=()=>({...pending,...recordExternalKit(pending,{date:'2026-01-02',identityAttached:true})});
const accepted=d=>({...d,...recordAppointmentCheck(d,{date:'2026-01-03',result:'accepted'})});
test('only current signature / appointment task; no changes in CRM or Google projection before verified appointment',()=>{
 for(const d of [pending,signed(),{...signed(),approved:true,agentAppointment:{acceptedAt:'2026-01-03'}}]){
  assert.ok(!homeTasks([client(d)]).some(t=>t.id.includes(':change:')));
  assert.ok(!operationalProjection({clients:[client(d)]}).some(t=>t.key.includes(':change:')));
 }
 assert.deepEqual(homeTasks([client(signed())]).map(t=>t.id),['c:d:appointment-check']);
 assert.throws(()=>recordChangeCheck(signed(),'track',{date:'2026-01-10',reference:'site',result:'complete',siteChecked:true,actual:{track:'מניות'}}));
 assert.deepEqual(homeTasks([client(accepted(signed()))]).map(t=>t.id),['c:d:change:track']);
});
test('zero and current fees are not an agreed discount; old uncertain records need an explicit decision',()=>{
 const legacy={...pending,feeChangeRequested:undefined};
 for(const d of [pending,legacy])assert.deepEqual(changeRequests(d).map(t=>t.key),['track']);
 assert.equal(feeAgreementPending(legacy),true);assert.equal(feeAgreementPending(pending),false);
 assert.ok(!agreedChanges(legacy).includes('דמי ניהול'));
 const summary=buildSummary(client(legacy)).split('סוכם:')[1];assert.ok(!summary.includes('0.4%'));
 const confirmed={...legacy,...recordFeeChangeAgreement(legacy,true)};assert.ok(hasFeeChange(confirmed));
 assert.ok(changeRequests(confirmed).some(t=>t.key==='fees'));
 const rejected={...legacy,...recordFeeChangeAgreement(legacy,false)};assert.equal(rejected.balanceFee,0.4);assert.equal(hasFeeChange(rejected),false);
 const history={...legacy,changeTasks:{fees:{submittedAt:'2026-01-01',done:false}}};assert.ok(hasFeeChange(history));assert.throws(()=>recordFeeChangeAgreement(history,false));
});
test('track-only completion preserves product fees, not stale terms from the decision',()=>{
 let d=accepted(signed());d={...d,...recordChangeCheck(d,'track',{date:'2026-01-10',reference:'site verified',result:'complete',siteChecked:true,actual:{track:'מניות'}})};
 assert.ok(changeWorkflowReady(d));
 const c=client(d),next=completeDecision(c,d);assert.equal(next.products[0].balanceFee,0.6);assert.equal(next.products[0].premium,20);assert.equal(next.products[0].track,'מניות');assert.equal(c.products[0].track,undefined);
 assert.equal(changeWorkflowReady({...d,feeChangeRequested:undefined}),false);
});
