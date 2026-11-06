import test from 'node:test';
import assert from 'node:assert/strict';
import {productionFields,productionVerificationReady,recordProductionVerification,productionFieldMatches,productionProductValues} from '../.local-preview/production-verification.js';
import {recordSmsKit,recordExternalKit,completeTask,closeTreatment,followupTaskDone,signedKit,businessDate,transferReady} from '../.local-preview/workflow-process.js';
import {readyToClose,completeDecision} from '../.local-preview/workflow-model.js';
import {recordAppointmentCheck,agentAppointmentReady,recordChangeSubmission,recordChangeCheck,changeRequests,changeWorkflowReady,addCalendarMonths} from '../.local-preview/agent-change-rules.js';
import {recordInformationSubmission,recordInformationCheck,informationAppointmentTask} from '../.local-preview/info-appointment.js';
import {homeTasks} from '../.local-preview/workflow-home-model.js';
import {reviewProducts,validateAssessments} from '../frontend/src/lib/productReview.js';
const file={name:'synthetic.txt',data:'data:text/plain,SYNTHETIC'};
function life(){const d={id:'d',productId:'p',productCategory:'ביטוח חיים',action:'החלפת מוצר קיים — שחלוף בהתאם לסיכום',target:'מגדל',targetPremium:85,targetCoverage:500000,agreedCoverage:'מוות מכל סיבה',agreedExclusions:'ללא החרגות',agreedBeneficiaries:'בן זוג 100%',agreedEffective:'2026-08-01',policy:'new',effective:'2026-08-01',approved:true,evidence:'company source',cancelAnnex:'ג',policyDocument:file};return {...d,...recordSmsKit(d,'2026-07-01T10:00:00Z')};}
function actual(d){return Object.fromEntries(productionFields(d).map(f=>[f.key,f.actualOnly?'new':f.date&&!f.compare?'2026-08-01':String(f.expected??'')]));}
function verify(d){return {...d,...recordProductionVerification(d,{values:actual(d),source:'company_document',reference:'policy page 1'})};}
test('life and health issuance permits future coverage start, not future verification or invalid dates',()=>{
 for(const productCategory of ['ביטוח חיים','בריאות']){
  const d={...life(),productCategory,agreedEffective:'2099-08-25',...(productCategory==='בריאות'?{riders:['תרופות'],agreedCoverage:undefined}:{agreedCoverage:undefined})};
  const checked=verify(d);assert.ok(productionVerificationReady(checked));
  assert.equal(productionVerificationReady({...checked,productionVerification:{...checked.productionVerification,checkedAt:'2099-08-15T12:00:00Z'}}),false);
  assert.equal(productionFieldMatches(productionFields(d).find(f=>f.key==='effective'),'2099-02-30'),false);
 }
 assert.ok(!productionFields({...life(),agreedCoverage:undefined}).some(f=>f.key==='coverage'));
 const health={...life(),productCategory:'בריאות',riders:['תרופות'],riderDetail:'',agreedCoverage:'stale duplicate'};
 assert.equal(productionFields(health).find(f=>f.key==='coverage').expected,'תרופות');
 const saving={...life(),productCategory:'גמל'};assert.equal(productionFieldMatches(productionFields(saving).find(f=>f.key==='effective'),'2099-08-25'),false);
});
test('life actual-vs-agreed verification including beneficiaries, dates and evidence guards model, not just UI',()=>{
 let d=life();assert.equal(!!readyToClose(d),false);assert.equal(productionVerificationReady(d),false);
 // The approved insurance tolerance is inclusive ±2 NIS; 88 is outside 85±2.
 const values=actual(d);for(const [key,value]of [['premium','88'],['beneficiaries','אחר 100%'],['effective','2026-02-30'],['company','חברה אחרת'],['coverageAmount','']])assert.throws(()=>recordProductionVerification(d,{values:{...values,[key]:value},source:'company_site',reference:'site'}));
 assert.throws(()=>recordProductionVerification({...d,policyDocument:null},{values,source:'company_document',reference:'policy'}));
 assert.throws(()=>recordProductionVerification(d,{values,source:'',reference:'policy'}));
 assert.throws(()=>recordProductionVerification(d,{values,source:'company_site',reference:' '}));
 const c={id:'c',products:[{id:'p',category:'ביטוח חיים',company:'כלל',premium:110}],decisions:[{...d,produced:true}],appointments:[]};assert.throws(()=>completeTask(c,'d','verify',{check0:true,check1:true,check2:true,check3:true,check4:true}));
 d=verify(d);assert.ok(readyToClose(d));const updated=completeDecision({...c,decisions:[d]},d);assert.equal(updated.products[1].premium,85);assert.equal(updated.products[1].beneficiaries,'בן זוג 100%');assert.equal(updated.products[0].archived,undefined);assert.ok(updated.decisions[0].tasks.verify.done);assert.throws(()=>completeDecision(updated,d));
});
test('missing expected terms hold legacy pending decisions; explicit separate agreement resolves, never inferred from source or actual',()=>{
 const d=life();delete d.agreedExclusions;assert.equal(productionVerificationReady({...d,productionVerification:{checkedAt:new Date().toISOString(),source:'company_site',reference:'test',values:actual(d)}}),false);
 assert.throws(()=>verify(d));const completed=verify({...d,productionAgreement:{exclusions:'ללא החרגות',reference:'approved proposal'}});assert.ok(productionVerificationReady(completed));
 assert.equal(productionFieldMatches({numeric:true,expected:0},'0'),true);assert.equal(productionFieldMatches({numeric:true,expected:0},''),false);
});
test('all savings and insurance categories expose relevant independent actual fields',()=>{
 for(const productCategory of ['השתלמות','גמל','גמל להשקעה','ביטוח מנהלים','פנסיה','בריאות','תאונות אישיות','מחלות קשות','סיעוד','ביטוח אחר']){
  const d={...life(),action:'הצטרפות למוצר חדש בהתאם לסיכום',productCategory,depositFee:0,balanceFee:0.2,track:'כללי'};assert.ok(productionVerificationReady(verify(d)),productCategory);
 }
});
test('verified supplemental coverage, exclusions and track are carried into the actual product',()=>{
 const d=life();delete d.agreedCoverage;delete d.agreedExclusions;delete d.targetCoverage;
 const checked=verify({...d,productionAgreement:{coverage:'כיסוי מוות מוסכם',coverageAmount:750000,exclusions:'חריג מוסכם',reference:'approved original'}});
 const client={products:[{id:'p',category:'ביטוח חיים',company:'כלל'}],decisions:[checked]};
 const product=completeDecision(client,checked).products[1];assert.deepEqual(product.coverage,[{name:'כיסוי מוות מוסכם',amount:750000}]);assert.equal(product.exclusions,'חריג מוסכם');
 const health=verify({...life(),productCategory:'בריאות',agreedCoverage:undefined,riders:['תרופות','ניתוחים'],riderDetail:'השתלות'});assert.deepEqual(productionProductValues(health).coverage,[{name:'תרופות'},{name:'ניתוחים'},{name:'השתלות'}]);
 const saving=verify({...life(),action:'הצטרפות למוצר חדש בהתאם לסיכום',productCategory:'השתלמות',depositFee:0,balanceFee:0.2,productionAgreement:{track:'מניות מאושר',reference:'agreed track'}});assert.equal(productionProductValues(saving).track,'מניות מאושר');
});
test('legacy checkbox or invalidated actual check cannot cancel or close; completed histories remain unchanged',()=>{
 for(const d of [{...life(),produced:true},{...verify(life()),produced:true,productionVerification:{...verify(life()).productionVerification,checkedAt:null}}]){
  d.tasks=Object.fromEntries(['verify','deliver','call'].map(key=>[key,{done:true}]));const c={id:'c',name:'test',products:[{id:'p'}],decisions:[d],appointments:[]};
  assert.equal(followupTaskDone(d,'verify'),false);assert.ok(homeTasks([c]).some(t=>t.id==='c:d:verify'));
  assert.throws(()=>completeTask(c,d.id,'verify',{}));assert.throws(()=>completeTask(c,d.id,'cancelCheck',{confirmed:true,reference:'written',when:'2026-08-02',file}));
  d.tasks.cancelCheck={done:true};assert.throws(()=>closeTreatment(c,d));d.completed=true;assert.equal(closeTreatment(c,d),c);assert.equal(followupTaskDone(d,'verify'),true);
 }
});
test('active transfer model requires a real deposit date and finite amounts even if the optional flag is disabled',()=>{
 const d={action:'ניוד קרן פנסיה בהתאם לסיכום',sourceBalance:1000,fundsConfirmed:true,transfer:{inactive:false,requiresDeposit:true,verified:true,payrollSent:true,depositDate:'2026-08-01',depositActual:1850,salary:10000,employee:6,employer:6.5,severance:6,received:1000,document:file}};assert.ok(transferReady(d));
 for(const patch of [{depositDate:'2026-02-30'},{depositDate:'2099-01-01'},{depositDate:'',requiresDeposit:false},{depositActual:Infinity,depositResolution:'cannot justify invalid data'},{salary:Infinity,depositResolution:'invalid'}])assert.equal(!!transferReady({...d,transfer:{...d.transfer,...patch}}),false);
 assert.equal(!!transferReady({...d,sourceBalance:Infinity,transfer:{...d.transfer,resolution:'invalid'}}),false);
});
test('manual SMS recording requires date and identity checklist; explicit submission replaces reference/signature recheck and does not fabricate an API send',()=>{
 const base={action:'מינוי סוכן ללא שינוי בתנאים'};
 for(const data of [{date:'2099-01-01',reference:'a',identityAttached:true},{date:'2026-01-01',reference:'a'}])assert.throws(()=>recordExternalKit(base,data));
 const withoutReference={...base,...recordExternalKit(base,{date:'2026-01-01',identityAttached:true})};assert.ok(signedKit(withoutReference));assert.equal(withoutReference.sms2010.reference,undefined);assert.equal(withoutReference.sms2010.confirmedBySubmit,true);assert.equal(withoutReference.infoAppointment,undefined);
 const d={...base,...recordExternalKit(base,{date:'2026-01-01',reference:'external SMS record',identityAttached:true})};assert.ok(signedKit(d));assert.equal(d.sms2010.simulated,false);assert.ok(d.sms2010.manual);assert.ok(d.sms2010.identityAttached);assert.throws(()=>recordExternalKit(d,{date:'2026-01-01',reference:'again',identityAttached:true}));
});
function change(){return {id:'d',productId:'p',productCategory:'השתלמות',action:'מינוי סוכן וביצוע השינויים שבסיכום',sent:true,sentAt:'2026-01-01T12:00:00Z',signed:true,track:'מניות',balanceFee:0.2,feeChangeRequested:true};}
test('appointment website verification and independent track submission; discounts use acceptance plus calendar months then actual submission plus ten business days',()=>{
 let d=change();assert.equal(agentAppointmentReady({...d,approved:true,effective:'2026-01-01'}),false);assert.equal(changeRequests(d).find(t=>t.key==='fees').due,'');assert.equal(changeRequests(d).find(t=>t.key==='track').due,businessDate('2026-01-01',10));
 assert.ok(agentAppointmentReady({...d,...recordAppointmentCheck(d,{date:'2026-01-02',result:'accepted'})}));
 d={...d,...recordAppointmentCheck(d,{date:'2026-02-02',reference:'site shows policy',siteChecked:true,acceptedAt:'2026-01-31'})};assert.ok(agentAppointmentReady(d));assert.equal(changeRequests(d).find(t=>t.key==='fees').due,'2026-04-30');assert.equal(addCalendarMonths('2024-11-30',3),'2025-02-28');
 assert.throws(()=>recordChangeSubmission(d,'fees',{date:'2026-04-29',reference:'too soon'}));
 d={...d,...recordChangeSubmission(d,'fees',{date:'2026-05-01',reference:'SMS request'})};assert.equal(changeRequests(d).find(t=>t.key==='fees').due,businessDate('2026-05-01',10));
 d={...d,...recordChangeCheck(d,'fees',{date:'2026-05-15',reference:'not yet',result:'pending'})};assert.equal(changeRequests(d).find(t=>t.key==='fees').due,businessDate('2026-05-15',2));assert.equal(changeWorkflowReady(d),false);
 assert.throws(()=>recordChangeCheck(d,'fees',{date:'2026-05-18',reference:'receipt only',result:'complete',actual:{balanceFee:0.2},siteChecked:false}));
 d={...d,...recordChangeCheck(d,'fees',{date:'2026-05-18',reference:'site fee',result:'complete',actual:{balanceFee:0.2},siteChecked:true})};assert.equal(changeWorkflowReady(d),false,'track independently open');
 d={...d,...recordChangeCheck(d,'track',{date:'2026-05-18',reference:'site track',result:'complete',actual:{track:'מניות'},siteChecked:true})};assert.ok(changeWorkflowReady(d));
});
test('rejection routes: fees to client today; track first to company; no fabricated alternative or completion',()=>{
 let d=change();d={...d,...recordAppointmentCheck(d,{date:'2026-01-02',result:'accepted'})};d={...d,...recordChangeCheck(d,'track',{date:'2026-01-15',reference:'track rejected',result:'rejected'})};assert.equal(d.changeTasks.track.clientDecisionRequired,false);assert.equal(d.changeTasks.track.done,false);
 d={...d,...recordChangeCheck(d,'track',{date:'2026-01-16',reference:'cannot execute original',result:'alternative'})};assert.equal(d.changeTasks.track.clientDecisionRequired,true);
 const c={id:'c',name:'Synthetic',call:'yes',products:[{id:'p'}],decisions:[d]};assert.equal(homeTasks([c],'2026-01-16').find(t=>t.id==='c:d:change:track').urgent,true);
});
test('information appointment independent from cancellation; ten-day check and no-access two-day follow-up persist even after main closure',()=>{
 let d=life();assert.equal(informationAppointmentTask(d).due,'');assert.throws(()=>recordInformationSubmission(d,{date:'2026-08-01',reference:'sent'}));
 d={...d,...recordInformationSubmission(d,{date:'2026-08-01',reference:'sent manually',document:file})};assert.equal(informationAppointmentTask(d).due,businessDate('2026-08-01',10));
 d={...d,...recordInformationCheck(d,{date:'2026-08-16',reference:'no access',access:false})};assert.equal(informationAppointmentTask(d).due,businessDate('2026-08-16',2));assert.equal(d.tasks?.cancelCheck,undefined);
 d.completed=true;const c={id:'c',name:'test',products:[{id:'p'}],decisions:[d]};assert.ok(homeTasks([c]).some(t=>t.id==='c:d:info-appointment'));
 d={...d,...recordInformationCheck(d,{date:'2026-08-18',reference:'access verified',access:true})};assert.equal(informationAppointmentTask(d),null);assert.equal(d.tasks?.cancelCheck,undefined);
});
test('premium proposals preserve current premium; validated numeric proposal survives save and publication',()=>{
 const ps=reviewProducts({insurance_data:[{id:'life',type:'life',monthlyPremium:150}]}),p=ps[0];const entry=v=>({[p.key]:{premium:{status:'action',note:'proposed cheaper premium',proposedPremium:v,proposedCoverage:500000}}});
 assert.equal(validateAssessments(entry('120'),ps,true)[p.key].premium.proposedPremium,120);assert.equal(p.values.premium,150);
 for(const bad of ['',-1,'invalid',Infinity])assert.throws(()=>validateAssessments(entry(bad),ps,true));assert.equal(validateAssessments(entry(0),ps,true)[p.key].premium.proposedPremium,0);
});
