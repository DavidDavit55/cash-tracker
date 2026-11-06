import test from 'node:test';
import assert from 'node:assert/strict';
import {noAction,kitDecisions,buildSummary} from '../.local-preview/workflow-model.js';
import {homeTasks} from '../.local-preview/workflow-home-model.js';
test('health not discussed does not imply refusal or create execution work',()=>{
 const d={id:'h',productId:'h',action:'לא הוצע / לא נדון בפגישה',proposedProduct:{category:'בריאות',proposed:true},decisionRecorded:true};
 const c={id:'c',name:'Synthetic',call:'done',products:[{id:'p',category:'פנסיה'}],decisions:[d],summarySent:true};
 assert.equal(noAction(d),true);
 assert.deepEqual(kitDecisions(c),[]);
 assert.deepEqual(homeTasks([c]),[]);
 const summary=buildSummary(c);
 assert.ok(summary.includes(d.action));
 assert.ok(!summary.includes('בחר שלא להצטרף'));
 assert.ok(!summary.includes('סוכם:'));
});
