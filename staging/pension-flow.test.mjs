import test from 'node:test';
import assert from 'node:assert/strict';
import {recordPensionSignature,openingDue,openingRequired,recordOpening} from '../.local-preview/pension-flow.js';
import {transferStage,transferNext,payrollCheckDate} from '../.local-preview/workflow-transfer-stages.js';
import {homeTasks} from '../.local-preview/workflow-home-model.js';
import {payrollMessage} from './payroll-mail.mjs';
import {transferReady} from '../.local-preview/workflow-process.js';
const base={id:'op',productId:'p',action:'ניוד קרן פנסיה בהתאם לסיכום',productCategory:'פנסיה',signatureSent:true,signatureSentAt:'2026-01-01T12:00:00Z',messagePrepared:true,messageText:'kept'};
test('opening gate also blocks payroll generation and completion outside the UI',()=>{
 const d={...base,...recordPensionSignature(base,{date:'2026-01-08',identityAttached:true}),transfer:{inactive:false}};
 assert.throws(()=>payrollMessage({decisions:[d]},{decisionId:'op',draft:{}}),/פתיחת הקופה/);
 assert.equal(transferReady({...d,fundsConfirmed:true}),false);
});
test('signature preserves WhatsApp and schedules opening from actual signature, skipping weekend',()=>{
 const d={...base,signatureMessageSentAt:'2026-01-01T13:00:00Z',...recordPensionSignature(base,{date:'2026-01-08',identityAttached:true})};
 assert.equal(d.messageText,'kept');assert.equal(d.messagePrepared,true);
 assert.equal(openingDue(d),'2026-01-12');assert.equal(transferStage(d),'opening');
 const tasks=homeTasks([{id:'c',name:'Test',products:[{id:'p'}],decisions:[d]}]);
 assert.equal(tasks.length,1);assert.equal(tasks[0].due,'2026-01-12');assert.match(tasks[0].id,/opening$/);
 assert.throws(()=>recordPensionSignature(base,{date:'2025-12-31',identityAttached:true}));
 assert.throws(()=>recordOpening(d,{policy:'123',date:'2026-01-07',evidence:'proof'}));
 const opened={...d,...recordOpening(d,{policy:'123',date:'2026-01-12',evidence:'proof'})};
 assert.equal(openingRequired(opened),false);assert.equal(transferStage(opened),'mode');
 assert.equal(openingRequired({...base,sent:true}),false);
});
test('active source waits for a real deposit, inactive source does not; monthly due unchanged',()=>{
 const active={...base,sent:true,transfer:{inactive:false,payrollSent:true,payrollSentAt:'2026-01-12'}};
 assert.equal(transferNext(active).due,'2026-02-20');
 for(const depositActual of ['',0,-1,'NaN'])assert.equal(transferStage({...active,transfer:{...active.transfer,depositDate:'2026-01-15',depositActual}}),'deposit');
 assert.equal(transferStage({...active,transfer:{...active.transfer,depositDate:'2099-01-15',depositActual:100}}),'deposit');
 assert.equal(transferStage({...active,transfer:{...active.transfer,depositDate:'2026-01-15',depositActual:100}}),'transfer');
 assert.equal(transferStage({...base,sent:true,transfer:{inactive:true}}),'transfer');
 assert.equal(payrollCheckDate('2026-12-01'),'2027-01-20');
});
