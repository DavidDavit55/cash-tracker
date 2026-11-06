import assert from 'node:assert/strict';
import {productionFields,productionFieldMatches,productionBlockers} from '../.local-preview/production-verification.js';
import {recordExternalKit} from '../.local-preview/workflow-process.js';
for(const productCategory of ['בריאות','ביטוח חיים','מחלות קשות']){
 const field=productionFields({productCategory,targetPremium:40}).find(f=>f.key==='premium');
 for(const amount of [38,39,40,41,42])assert.ok(productionFieldMatches(field,amount));
 for(const amount of [37.99,42.01,-1,''])assert.ok(!productionFieldMatches(field,amount));
}
assert.equal(recordExternalKit({productCategory:'בריאות',action:'הצטרפות למוצר חדש'},{date:'2026-09-30'}).sms2010.identityAttached,false);
assert.throws(()=>recordExternalKit({productCategory:'פנסיה'},{date:'2026-09-30'}));
const errors=productionBlockers({productCategory:'בריאות',targetPremium:40},{values:{premium:43}});
assert.ok(errors.some(s=>s.includes('2 ₪')));assert.ok(errors.some(s=>s.includes('מסמך הביצוע')));
console.log('PASS: inclusive premium tolerance, health-only ID exemption, explicit blockers');
