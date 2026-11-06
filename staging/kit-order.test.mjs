import test from 'node:test';
import assert from 'node:assert/strict';
import {recordSignatureDispatch} from '../.local-preview/workflow-process.js';
import {buildKitMessage,decisionStatus} from '../.local-preview/workflow-model.js';
test('dispatch precedes message and does not claim signature or company delivery',()=>{
 for(const action of ['ניוד קרן פנסיה בהתאם לסיכום','הצטרפות חדשה','מינוי סוכן ללא שינוי בתנאים']){
 const d={action,messagePrepared:true};
 const patch=recordSignatureDispatch(d,'2026-01-01');
 assert.equal(patch.signatureSent,true);assert.equal(patch.messagePrepared,false);
 assert.equal(patch.signed,undefined);assert.equal(patch.sent,undefined);
 assert.match(decisionStatus({...d,...patch}),/לאחר השליחה/);
 assert.throws(()=>recordSignatureDispatch({...d,...patch},'2026-01-01'));
 }
 assert.match(buildKitMessage({name:'בדיקה'}),/שלחתי לך ב־SMS/);
 assert.throws(()=>recordSignatureDispatch({},'2099-01-01'));
});
