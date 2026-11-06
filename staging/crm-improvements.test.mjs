import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSummary} from '../.local-preview/workflow-model.js';
import {operationalProjection} from './tasks.mjs';
import {depositDifference} from '../.local-preview/workflow-detail-rules.js';
import {transferStage} from '../.local-preview/workflow-transfer-stages.js';
import {transferReady} from '../.local-preview/workflow-process.js';
import {depositDefaults,pensionFields,pensionVerificationReady} from '../.local-preview/pension-verification.js';

test('defaults preserve existing percentages, zero and deliberately cleared inputs',()=>{
 assert.deepEqual(depositDefaults(),{employee:6,employer:6.5,severance:6});
 const x={salary:10000,employee:0,employer:'7',severance:''};
 assert.deepEqual(depositDefaults(x),x);
 assert.deepEqual(depositDefaults({employee:null}),{employee:6,employer:6.5,severance:6});
});
test('interactive pension checks require actual values, reject mismatch and revalidate changed agreement',()=>{
 const d={target:'הראל',depositFee:0,balanceFee:0.1,allocations:[{fundId:'100',name:'א',percent:60},{fundId:'200',name:'ב',percent:40}],transfer:{received:1200}};
 assert.equal(pensionVerificationReady(d),false);
 const values=Object.fromEntries(pensionFields(d).map(f=>[f.key,f.date?'2026-09-01':String(f.expected)]));
 d.pensionVerification={values,checkedAt:'2026-09-29'};assert.ok(pensionVerificationReady(d));
 for(const field of pensionFields(d)){
  assert.equal(pensionVerificationReady({...d,pensionVerification:{...d.pensionVerification,values:{...values,[field.key]:''}}}),false);
 }
 assert.equal(pensionVerificationReady({...d,balanceFee:0.2}),false);
 assert.equal(pensionVerificationReady({...d,pensionVerification:{values:{...values,percent0:59},checkedAt:'2026-09-29'}}),false);
 assert.equal(pensionVerificationReady({...d,pensionVerification:{values:{...values,date:'2099-01-01'},checkedAt:'2026-09-29'}}),false);
});

test('deposit tolerance is inclusive in both directions; unresolved gaps block even legacy verified transfers',()=>{
 const d={id:'d',action:'ניוד קרן פנסיה בהתאם לסיכום',fundsConfirmed:true,sourceBalance:1000,transfer:{inactive:false,requiresDeposit:true,payrollSent:true,salary:10000,employee:6,employer:6.5,severance:6,depositDate:'2026-09-29',verified:true,received:1000,document:{data:'test'}}};
 for(const actual of [1750,1850,1950]){
  const x={...d,transfer:{...d.transfer,depositActual:actual}};
  assert.equal(depositDifference(x).open,false);
  assert.equal(transferStage(x),'done');
  assert.ok(transferReady(x));
 }
 for(const actual of [1700,1749.99,1950.01,2000]){
  const x={...d,transfer:{...d.transfer,depositActual:actual,depositResolution:'  '}};
  assert.equal(transferStage(x),'deposit');assert.equal(transferReady(x),false);
  assert.ok(operationalProjection({clients:[{id:'c',name:'בדיקה',products:[],decisions:[x]}]}).some(t=>t.key==='c:d:deposit-gap'));
  const resolved={...x,transfer:{...x.transfer,depositResolution:'נבדק מול חשבת השכר ותועד הסבר'}};
  assert.equal(transferStage(resolved),'done');assert.ok(transferReady(resolved));
 }
});

test('summary labels existing and agreed management fees including zero',()=>{
 const c={name:'בדיקה',products:[{id:'p',category:'פנסיה',company:'חברה',depositFee:0,balanceFee:0.2}],decisions:[{id:'d',productId:'p',action:'ניוד לגוף אחר',depositFee:0,balanceFee:0.1}]};
 const s=buildSummary(c);
 assert.ok(s.includes('דמי ניהול מהפקדה 0%'));
 assert.ok(s.includes('דמי ניהול מצבירה 0.2%'));
 assert.ok(s.includes('דמי ניהול מצבירה 0.1%'));
 assert.equal((s.match(/דמי ניהול מהפקדה 0%/g)||[]).length,2);
});

test('information follow-up is projected once, clears when information arrives, and excludes intro',()=>{
 const c={id:'c',name:'בדיקה',call:'התקיימה שיחת היכרות',products:[],decisions:[]};
 let items=operationalProjection({clients:[c]});
 assert.equal(items.length,1);
 assert.equal(items[0].key,'c:info');
 assert.ok(items[0].title.includes('להשלים פרטים ולעקוב אחרי בקשות מידע'));
 assert.deepEqual(operationalProjection({clients:[{...c,products:[{id:'p'}]}]}),[]);
 assert.deepEqual(operationalProjection({clients:[{...c,call:''}]}),[]);
});
