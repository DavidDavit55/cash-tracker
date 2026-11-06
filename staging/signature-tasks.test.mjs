import test from 'node:test';
import assert from 'node:assert/strict';
import {homeTasks} from '../.local-preview/workflow-home-model.js';
import {recordSignatureMessageSent,reuseSignatureMessage} from '../.local-preview/signature-batch.js';
test('signature task appears only after WhatsApp sent; prepared text is not sent',()=>{
 const d={id:'d',productId:'p',action:'מינוי סוכן ללא שינוי בתנאים',signatureSent:true,signatureSentAt:'2026-01-01',messagePrepared:true,messageText:'Test'};
 const c={id:'c',name:'Test',products:[{id:'p'}],decisions:[d]};
 const tasks=homeTasks([c]);assert.deepEqual(tasks.map(t=>t.id),['c:d:whatsapp']);
 const sent=recordSignatureMessageSent(c,'d');assert.equal(sent.decisions[0].signed,undefined);
 assert.deepEqual(homeTasks([sent]).map(t=>t.id),['c:d:signature']);
 assert.equal(homeTasks([{...c,decisions:[{...d,signed:true,sent:true}]}]).filter(t=>t.id.endsWith(':whatsapp')).length,1);
 assert.throws(()=>recordSignatureMessageSent({...c,decisions:[{...d,messagePrepared:false}]},'d'));
});
test('explicit reuse links the existing receipt without assuming signature or sending again',()=>{
 const source={id:'a',signatureSent:true,messageText:'sent',signatureMessageSentAt:'2026-01-01T12:00:00Z'};
 const target={id:'b',signatureSent:true,action:'מינוי סוכן ללא שינוי בתנאים'};
 const c={decisions:[source,target,{id:'other',signatureSent:true}]};
 const n=reuseSignatureMessage(c,'b','a');
 assert.equal(n.decisions[1].signatureMessageSentAt,source.signatureMessageSentAt);
 assert.equal(n.decisions[1].signed,undefined);assert.equal(n.decisions[2].signatureMessageSentAt,undefined);
 assert.equal(c.decisions[1].signatureMessageSentAt,undefined);
 assert.throws(()=>reuseSignatureMessage(c,'a','b'));
});
