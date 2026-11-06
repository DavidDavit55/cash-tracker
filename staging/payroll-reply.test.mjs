import test from 'node:test';
import assert from 'node:assert/strict';
import {payrollReplyPending,payrollReplyDue,recordPayrollReply} from '../.local-preview/payroll-reply.js';
import {homeTasks} from '../.local-preview/workflow-home-model.js';
import {operationalProjection} from './tasks.mjs';
import {transferStage} from '../.local-preview/workflow-transfer-stages.js';
const d={id:'d',productId:'p',action:'ניוד קרן פנסיה בהתאם לסיכום',sent:true,signatureMessageSentAt:'2026-01-01',transfer:{inactive:false,payrollSent:true,payrollSentAt:'2026-01-01',salaryMonth:'2026-01'}};
const client=x=>({id:'c',name:'בדיקה',call:'yes',products:[{id:'p',category:'פנסיה'}],decisions:[x]});
test('two business days and independent deposit task in CRM and Google',()=>{
 assert.equal(payrollReplyDue(d),'2026-01-05');
 const tasks=homeTasks([client(d)],'2026-01-05');
 assert.equal(tasks.find(t=>t.id.endsWith(':payroll-reply')).due,'2026-01-05');
 assert.equal(tasks.find(t=>t.id.endsWith(':funds:deposit')).due,'2026-02-20');
 assert.ok(operationalProjection({clients:[client(d)]}).some(t=>t.key.endsWith(':payroll-reply')));
 assert.equal(transferStage(d),'deposit');
});
test('receipt/missing/no reply remain open, confirmed requires month and evidence, never fabricates deposit',()=>{
 for(const status of ['received','missing','no-reply']){const next={...d,...recordPayrollReply(d,{status,date:'2026-01-05',evidence:'בדיקה'})};assert.ok(payrollReplyPending(next));assert.equal(payrollReplyDue(next),'2026-01-07');assert.equal(next.transfer.payrollReply.history.length,1);}
 assert.throws(()=>recordPayrollReply(d,{status:'confirmed',date:'2026-01-05',evidence:'אושר'}));
 assert.throws(()=>recordPayrollReply(d,{status:'confirmed',date:'2025-12-31',evidence:'אושר',salaryMonth:'2026-01'}));
 const next={...d,...recordPayrollReply(d,{status:'confirmed',date:'2026-01-05',evidence:'מייל אישור',salaryMonth:'2026-01'})};
 assert.equal(payrollReplyPending(next),false);assert.equal(next.transfer.depositDate,undefined);assert.equal(next.transfer.depositActual,undefined);assert.equal(transferStage(next),'deposit');
 assert.ok(homeTasks([client(next)]).some(t=>t.id.endsWith(':funds:deposit')));
});
test('no task before send, inactive or completed; actual deposit supersedes reply',()=>{
 for(const x of [{...d,sent:false},{...d,completed:true},{...d,stopped:true},{...d,transfer:{...d.transfer,inactive:true}},{...d,transfer:{...d.transfer,payrollSent:false}},{...d,transfer:{...d.transfer,depositDate:'2026-01-10',depositActual:100}}])assert.equal(payrollReplyPending(x),false);
});
