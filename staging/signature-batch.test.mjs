import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchBatch,dispatchCandidates,messageBatchIds,applySharedSignature} from '../.local-preview/signature-batch.js';
import {recordExternalKit} from '../.local-preview/workflow-process.js';
test('shared signature validates each product, preserves signed records and separates pension followup',()=>{
 const n=dispatchBatch(c,['a','b'],'2026-01-01','batch');
 const patch=recordExternalKit(n.decisions[1],{date:'2026-01-02',identityAttached:true});
 const signed=applySharedSignature(n,'b',patch);
 assert.equal(signed.decisions[0].pensionFlow.signedDate,'2026-01-02');
 assert.equal(signed.decisions[1].pensionFlow,undefined);
 assert.equal(signed.decisions[0].signed,true);
 assert.equal(signed.decisions[1].signed,true);
 assert.equal(signed.decisions[3],n.decisions[3]);
 assert.equal(n.decisions[0].signed,undefined);
 assert.deepEqual(applySharedSignature(signed,'b',patch),signed);
 const legacy={...n,decisions:n.decisions.map(d=>({...d,signatureBatchId:undefined}))};
 const one=applySharedSignature(legacy,'b',patch);
 assert.equal(one.decisions[0].signed,undefined);
 const repaired=applySharedSignature(one,'b',one.decisions[1],['a']);
 assert.equal(repaired.decisions[0].signed,true);
 assert.equal(repaired.decisions[1],one.decisions[1]);
 assert.throws(()=>applySharedSignature(n,'b',{...patch,sms2010:{...patch.sms2010,identityAttached:false}}));
 assert.throws(()=>applySharedSignature(n,'b',patch,['c']));
});
const c={summarySent:true,decisions:[{id:'a',productId:'a',action:'ניוד קרן פנסיה בהתאם לסיכום'},{id:'b',productId:'b',action:'מינוי סוכן ללא שינוי בתנאים'},{id:'c',productId:'c',action:'להשאיר ללא שינוי'},{id:'d',productId:'d',action:'הצטרפות חדשה'}]};
test('one dispatch date and message for selected products, no inferred signature',()=>{
 const n=dispatchBatch(c,['a','b'],'2026-01-01','batch');
 for(const d of n.decisions.slice(0,2)){assert.equal(d.signatureSentAt,'2026-01-01T12:00:00Z');assert.equal(d.signed,undefined);assert.equal(d.sent,undefined);}
 assert.deepEqual(messageBatchIds(n,n.decisions[0]),['a','b']);
 assert.deepEqual(dispatchCandidates(n).map(d=>d.id),['d']);
 assert.equal(c.decisions[0].signatureSent,undefined);
 assert.throws(()=>dispatchBatch(n,['a'],'2026-01-01','new'));
 assert.throws(()=>dispatchBatch(c,['c'],'2026-01-01','new'));
 assert.throws(()=>dispatchBatch(c,[],'2026-01-01','new'));
 assert.throws(()=>dispatchBatch({...c,summarySent:false},['a'],'2026-01-01','new'));
 const second=dispatchBatch(n,['d'],'2026-01-02','second');
 assert.deepEqual(messageBatchIds(second,second.decisions[3]),['d']);
});

test('shared signature is atomic when a sibling has a later dispatch date; no signature leaks to another batch',()=>{
 const n=dispatchBatch(c,['a','b'],'2026-01-01','batch');
 const later=dispatchBatch(n,['d'],'2026-01-03','separate');
 const patch=recordExternalKit(later.decisions[1],{date:'2026-01-02',identityAttached:true});
 const signed=applySharedSignature(later,'b',patch);
 assert.equal(signed.decisions[3].signed,undefined);
 const invalid={...later,decisions:later.decisions.map(d=>d.id==='a'?{...d,signatureSentAt:'2026-01-03T12:00:00Z'}:d)};
 assert.throws(()=>applySharedSignature(invalid,'b',patch));
 assert.ok(invalid.decisions.every(d=>!d.signed));
});
