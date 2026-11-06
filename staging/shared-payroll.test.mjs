import test from 'node:test';
import assert from 'node:assert/strict';
import {sharePayrollDraft} from '../.local-preview/shared-payroll.js';
test('shares only draft fields; retains independent source states and refuses conflicting data',()=>{
 const c={consolidations:[{id:'g',sourceDecisionIds:['a','b']}],decisions:['a','b'].map((id,i)=>({id,consolidationId:'g',target:'הראל',targetProductId:'t',transfer:{inactive:!!i,received:i}}))};
 const draft={payrollEmail:'payroll@example.com',salaryMonth:'2026-10',annex:{id:'file'},payrollSent:true,received:999};
 const n=sharePayrollDraft(c,'a',draft);assert.equal(n.decisions[1].transfer.payrollEmail,draft.payrollEmail);assert.equal(n.decisions[1].transfer.inactive,true);assert.equal(n.decisions[1].transfer.received,1);assert.equal(n.decisions[1].transfer.payrollSent,undefined);assert.equal(c.decisions[1].transfer.payrollEmail,undefined);
 assert.throws(()=>sharePayrollDraft(n,'a',{...draft,payrollEmail:'other@example.com'}));
});
