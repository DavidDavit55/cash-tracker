import test from 'node:test';
import assert from 'node:assert/strict';
import {taskList,completeTask,closeTreatment,recordSmsKit,cancellationEvidence,cancellationReminder,businessDate} from '../.local-preview/workflow-process.js';
import {homeTasks} from '../.local-preview/workflow-home-model.js';
import {operationalProjection} from './tasks.mjs';
import {productionFields,recordProductionVerification} from '../.local-preview/production-verification.js';

const file={name:'cancellation.txt',data:'data:text/plain,SYNTHETIC'};
function fixture(){
 const d={id:'d',productId:'old',productCategory:'בריאות',target:'הראל',targetPremium:100,agreedCoverage:'כיסוי מאושר',agreedExclusions:'ללא',agreedEffective:'2026-08-02',policyDocument:file,action:'החלפת מוצר קיים — שחלוף בהתאם לסיכום',cancelAnnex:'ג',effective:'2026-08-02',produced:true,tasks:{verify:{done:true}}};
 Object.assign(d,recordSmsKit(d));
 // Written cancellation follows an actual saved production check, not an old boolean.
 Object.assign(d,recordProductionVerification(d,{values:Object.fromEntries(productionFields(d).map(f=>[f.key,f.actualOnly?'new':String(f.expected)])),source:'company_document',reference:'verified policy'}));
 return {id:'c',name:'Synthetic',call:'done',products:[{id:'old',category:'בריאות',pendingCancellation:true},{id:'new',category:'בריאות'}],decisions:[d],appointments:[],messages:[]};
}
const confirmation={reference:'אישור ביטול שנבדק',when:'2026-08-03',confirmed:true,file};
test('one cancellation task; early written confirmation archives only the old policy; idempotent',()=>{
 let c=fixture();const d=c.decisions[0];
 assert.deepEqual(taskList(d).map(t=>t.key),['verify','cancelCheck','call']);
 assert.ok(confirmation.when<businessDate(d.effective,14));
 assert.throws(()=>closeTreatment(c,d));
 c=completeTask(c,'d','cancelCheck',confirmation);
 assert.equal(c.products[0].archived,true);assert.equal(c.products[0].pendingCancellation,false);assert.equal(c.products[1].archived,undefined);
 assert.equal(c.decisions[0].kit,undefined,'do not fabricate a sending record for David');
 assert.equal(completeTask(c,'d','cancelCheck',confirmation),c);
 assert.equal(cancellationReminder(c.decisions[0]),null);
 assert.throws(()=>closeTreatment(c,c.decisions[0]),'delivery and client update still required');
 c.decisions[0].tasks.deliver={done:true};c.decisions[0].tasks.call={done:true};
 assert.equal(closeTreatment(c,c.decisions[0]).decisions[0].completed,true);
});
test('no bypass of production, signed kit, written evidence, confirmation or date validity',()=>{
 for(const patch of [{tasks:{}},{signed:false},{produced:false}]){const c=fixture();Object.assign(c.decisions[0],patch);assert.throws(()=>completeTask(c,'d','cancelCheck',confirmation));}
 for(const patch of [{file:null},{confirmed:false},{reference:' '},{when:''},{when:'2026-02-30'},{when:'2099-01-01'}])assert.throws(()=>completeTask(fixture(),'d','cancelCheck',{...confirmation,...patch}));
 assert.throws(()=>completeTask(fixture(),'d','cancelSend',{reference:'send'}));
 assert.throws(()=>completeTask(fixture(),'d','cancel',confirmation));
});
test('existing evidence is reused, but legacy cancel alone does not auto-close; audit history preserved',()=>{
 const c=fixture(),d=c.decisions[0];
 d.tasks.cancelSend={done:true,reference:'legacy send'};d.tasks.cancel={done:true,...confirmation};d.cancellationUrgent=true;
 assert.equal(cancellationEvidence(d),file);assert.ok(cancellationReminder(d));
 const updated=completeTask(c,'d','cancelCheck',{...confirmation,file:undefined});
 assert.equal(updated.decisions[0].tasks.cancelCheck.file,file);
 assert.deepEqual(updated.decisions[0].tasks.cancel,d.tasks.cancel);assert.deepEqual(updated.decisions[0].tasks.cancelSend,d.tasks.cancelSend);
 assert.equal(updated.decisions[0].cancellationUrgent,false);
 assert.equal(c.products[0].archived,undefined,'input record unchanged');
});
test('reminder uses original start plus 14 business days; one stable task, urgent at deadline even before production check',()=>{
 const c=fixture(),d=c.decisions[0],due=businessDate(d.effective,14);d.tasks={};
 const early=homeTasks([c],'2026-08-03').filter(t=>t.id==='c:d:cancelCheck');
 assert.equal(early.length,1);assert.equal(early[0].due,due);assert.equal(early[0].urgent,false);
 assert.equal(homeTasks([c],due).find(t=>t.id==='c:d:cancelCheck').urgent,true);
 assert.equal(homeTasks([c],'2026-09-01').filter(t=>/cancel/.test(t.id)).length,1);
 d.tasks.verify={done:true};d.cancellationUrgent=true;d.cancellationUrgentAt='2026-08-03T10:00:00Z';
 assert.equal(homeTasks([c],'2026-08-03').filter(t=>/cancel/.test(t.id)).length,1);
 assert.equal(homeTasks([c],'2026-08-03').find(t=>t.id==='c:d:cancelCheck').due,'2026-08-03');
 assert.equal(homeTasks([c],'2026-08-04').find(t=>t.id==='c:d:cancelCheck').due,'2026-08-03','manual urgent deadline does not slide to tomorrow');
 assert.equal(operationalProjection({clients:[c]}).filter(t=>t.key==='c:d:cancelCheck').length,1);
 const updated=completeTask(c,'d','cancelCheck',confirmation);
 assert.equal(operationalProjection({clients:[updated]}).filter(t=>/cancel/.test(t.key)).length,0);
});
