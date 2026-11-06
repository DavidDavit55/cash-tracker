import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSummary,summaryAction} from '../.local-preview/workflow-model.js';
test('pension summary uses recommendation wording without changing stored action or past summary',()=>{
 const d={productId:'p',action:'ניוד קרן פנסיה בהתאם לסיכום',target:'הראל'};
 const c={name:'Test',products:[{id:'p',category:'פנסיה'}],decisions:[d],summary:'historical'};
 assert.match(buildSummary(c),/סוכם: ניוד קרן הפנסיה להראל בהתאם להמלצה/);
 assert.equal(c.summary,'historical');assert.equal(d.action,'ניוד קרן פנסיה בהתאם לסיכום');
 assert.equal(summaryAction({...d,target:''}),'ניוד קרן הפנסיה בהתאם להמלצה');
 assert.equal(summaryAction({action:'להשאיר ללא שינוי'}),'להשאיר ללא שינוי');
});
