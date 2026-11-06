import test from 'node:test';
import assert from 'node:assert/strict';
import {clientUpsell,completeClientUpsell} from '../.local-preview/client-upsell.js';
import {homeTasks,resolveTaskLink,taskLinkHash} from '../.local-preview/workflow-home-model.js';
import {operationalProjection} from './tasks.mjs';
const date='2026-09-15T22:30:00Z';
const decision=(id,category='פנסיה')=>({id,productId:id,productCategory:category,action:'מינוי סוכן ללא שינוי בתנאים',completed:true,completedAt:date});
const client=()=>({id:'client',name:'בדיקה',call:'בוצע',products:[{id:'1',category:'פנסיה'},{id:'2',category:'בריאות'}],decisions:[decision('1'),decision('2','בריאות')]});
test('one client task for all categories, same completion day in Israel, stable across reads and Tasks',()=>{
 const c=client();c.decisions.push(...['השתלמות','גמל','ביטוח חיים','תאונות אישיות','מחלות קשות','סיעוד'].map((x,i)=>decision('extra'+i,x)));
 const before=JSON.stringify(c);
 for(const today of ['2026-09-16','2026-09-20']){
  const tasks=homeTasks([c],today);assert.equal(tasks.length,1);assert.equal(tasks[0].due,'2026-09-16');assert.equal(tasks[0].id,'client:client-upsell');
 }
 assert.equal(JSON.stringify(c),before);
 assert.equal(operationalProjection({clients:[c]}).length,1);
 assert.equal(resolveTaskLink([c],taskLinkHash('client:client-upsell')).clientId,c.id);
});
test('not before all original treatment completes; not on production/signature alone or undated history',()=>{
 const c=client();c.decisions[1].completed=false;c.decisions[1].produced=true;c.decisions[1].signed=true;assert.equal(clientUpsell(c),null);
 c.decisions[1].completed=true;delete c.decisions[1].completedAt;assert.equal(clientUpsell(c),null);
 c.decisions=[];assert.equal(clientUpsell(c),null);
 c.decisions=[{id:'h',action:'לא הוצע / לא נדון בפגישה'}];assert.equal(clientUpsell(c),null);
});
test('consolidation waits for group closure and yields one task',()=>{
 const c=client();c.consolidations=[{sourceDecisionIds:['1','2']}];assert.equal(clientUpsell(c),null);
 c.consolidations[0].completion={at:date};assert.ok(clientUpsell(c));assert.equal(homeTasks([c]).length,1);
});
test('persisted completion prevents duplicates, protects stale form, reopens only for new completed treatment',()=>{
 const c=client(),task=clientUpsell(c);assert.throws(()=>completeClientUpsell(c,{outcome:'הלקוח לא מעוניין',note:''},task.completionTokens));
 const done=completeClientUpsell(c,{outcome:'הלקוח לא מעוניין',note:'תועדה שיחה'},task.completionTokens);
 const saved=JSON.parse(JSON.stringify(done));assert.equal(clientUpsell(saved),null);assert.equal(homeTasks([saved]).length,0);assert.equal(operationalProjection({clients:[saved]}).length,0);
 assert.throws(()=>completeClientUpsell(saved,{outcome:'הלקוח לא מעוניין',note:'כפול'},task.completionTokens));
 saved.decisions.push({...decision('new'),completed:false});assert.equal(clientUpsell(saved),null);
 saved.decisions.at(-1).completed=true;assert.ok(clientUpsell(saved));assert.equal(homeTasks([saved]).length,1);
 assert.throws(()=>completeClientUpsell(saved,{outcome:'אין צורך בהצעה נוספת',note:'בדיקה'},task.completionTokens));
});
test('refused and treated products never proposed; untouched topics deduplicated',()=>{
 const c=client();c.products.push({id:'3',category:'גמל'},{id:'4',category:'גמל'},{id:'5',category:'סיעוד'});
 c.decisions.push({id:'refused',productId:'5',action:'לא מעוניין כרגע'});
 assert.deepEqual(clientUpsell(c).subjects,['גמל']);
});
