import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewProducts,reviewSummary,validateAssessments,HEALTH_CHECK_KEY} from './src/services/productReview.js';
const data={pension_data:[{id:'001',provider:'A',type:'pension',name:'Pension'}],insurance_data:[{id:'001',provider:'B',type:'life'}],har_bituach_data:[{id:'001',provider:'B',type:'life'}]};
const products=reviewProducts(data),p=products[0];
test('life cost proposal captures and validates sum insured without dropping it at save',()=>{
 const list=reviewProducts({insurance_data:[{id:'life',type:'life'}]});const key=list[0].key;
 const a=amount=>({[key]:{premium:{status:'action',note:'הזדמנות להוזיל',proposedPremium:80,proposedCoverage:amount}}});
 assert.equal(validateAssessments(a('500000'),list,true)[key].premium.proposedCoverage,500000);
 assert.doesNotThrow(()=>validateAssessments(a(''),list,false));
 for(const value of ['',0,-1,'invalid',Infinity])assert.throws(()=>validateAssessments(a(value),list,true));
});
test('fee proposals survive saving and allow tradeoffs between fee components',()=>{
 const list=reviewProducts({pension_data:[{id:'fees',type:'pension',feeFromDeposit:1.7}]});
 const key=list[0].key;
 const assessment=rate=>({[key]:{depositFee:{status:'improve',note:'Proposed reduction',proposedFee:rate}}});
 assert.equal(validateAssessments(assessment('1.5'),list,true)[key].depositFee.proposedFee,1.5);
 assert.doesNotThrow(()=>validateAssessments(assessment(''),list,false));
 for(const rate of ['',-1,'invalid'])assert.throws(()=>validateAssessments(assessment(rate),list,true));
 assert.equal(validateAssessments(assessment('0'),list,true)[key].depositFee.proposedFee,0);
});
test('schema parity and deduplication with insurer identity',()=>{assert.equal(readFileSync(new URL('./src/services/productReview.js',import.meta.url),'utf8'),readFileSync(new URL('../frontend/src/lib/productReview.js',import.meta.url),'utf8'));assert.equal(products.length,3);});
test('unchecked and missing do not imply healthy; critical finding takes precedence',()=>{assert.deepEqual(reviewSummary(products).counts,{good:0,improve:0,action:0,unknown:3,na:0});const values=Object.fromEntries(p.parameters.map(k=>[k,{status:'good',note:''}]));values.coverage={status:'action',note:'Review coverage'};const a={[p.key]:values};assert.equal(reviewSummary(products,a).counts.action,1);assert.equal(reviewSummary(products,a).reviewed,1);values.track={status:'missing',note:'Need profile'};assert.equal(reviewSummary(products,a).reviewed,0);assert.equal(reviewSummary(products,a).counts.action,1);});
test('reject foreign products, unknown fields and undocumented published findings',()=>{assert.throws(()=>validateAssessments({'foreign':{}},products));assert.throws(()=>validateAssessments({[p.key]:{arbitrary:{status:'good',note:''}}},products));const a={[p.key]:{coverage:{status:'action',note:''}}};assert.doesNotThrow(()=>validateAssessments(a,products,false));assert.throws(()=>validateAssessments(a,products,true));});

test('health coverage is checked even with no products; absence alone is unknown',()=>{
 const checks=reviewProducts({});assert.equal(checks.length,1);assert.equal(checks[0].key,HEALTH_CHECK_KEY);
 assert.equal(reviewSummary(checks).counts.unknown,1);
 const confirmed={[HEALTH_CHECK_KEY]:{healthDrugs:{status:'action',note:'Verified missing coverage; discuss suitable protection'}}};
 assert.equal(reviewSummary(checks,confirmed).counts.action,1);
 assert.doesNotThrow(()=>validateAssessments(confirmed,checks,true));
 assert.equal(reviewSummary(reviewProducts({insurance_data:[{id:'h',type:'health'}]})).counts.unknown,2);
});

test('basic health requires all three agent-defined covers; one missing cover prevents green',()=>{
 const checks=reviewProducts({}), keys=checks[0].parameters;
 assert.deepEqual(keys,['healthTransplants','healthDrugs','healthSurgery']);
 const entries=Object.fromEntries(keys.map(k=>[k,{status:'good',note:''}]));
 assert.equal(reviewSummary(checks,{[HEALTH_CHECK_KEY]:entries}).counts.good,1);
 entries.healthDrugs={status:'action',note:'Verified absent'};
 assert.equal(reviewSummary(checks,{[HEALTH_CHECK_KEY]:entries}).counts.action,1);
 delete entries.healthDrugs;
 assert.equal(reviewSummary(checks,{[HEALTH_CHECK_KEY]:entries}).counts.unknown,1);
});

test('explicit missing coverage is actionable and requires published explanation',()=>{
 const checks=reviewProducts({});const a={[HEALTH_CHECK_KEY]:{healthSurgery:{status:'noCoverage',note:'Verified missing cover'}}};
 assert.equal(reviewSummary(checks,a).counts.action,1);
 assert.doesNotThrow(()=>validateAssessments(a,checks,true));
 a[HEALTH_CHECK_KEY].healthSurgery.note='';assert.throws(()=>validateAssessments(a,checks,true));
});
