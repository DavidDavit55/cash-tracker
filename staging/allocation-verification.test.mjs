import test from 'node:test';
import assert from 'node:assert/strict';
import {productionFields,productionFieldMatches} from '../.local-preview/production-verification.js';
import {pensionFields,pensionVerificationReady} from '../.local-preview/pension-verification.js';
const base={action:'ניוד קרן פנסיה',productCategory:'פנסיה',target:'הראל',depositFee:1,balanceFee:0.1,transfer:{received:500},allocations:[{name:'מניות',fundId:'2175',percent:50},{name:'סחיר',fundId:'15277',percent:25},{name:'S&P 500',fundId:'13415',percent:25}]};
test('all production categories verify allocation percentages, not fund numbers',()=>{
 for(const category of ['פנסיה','גמל','השתלמות','גמל להשקעה','ביטוח מנהלים']){
 const fields=productionFields({...base,productCategory:category});assert.equal(fields.some(f=>/^fund/.test(f.key)),false);assert.equal(fields.filter(f=>/^percent/.test(f.key)).length,3);assert.equal(productionFieldMatches(fields.find(f=>f.key==='percent0'),25),false);assert.equal(productionFieldMatches(fields.find(f=>f.key==='percent0'),50),true);
 }
});
test('pension verification succeeds without fund IDs and still rejects wrong or missing percentages',()=>{
 const values=Object.fromEntries(pensionFields(base).map(f=>[f.key,f.date?'2026-01-01':f.expected]));
 const d={...base,pensionVerification:{checkedAt:'2026-01-01',values}};assert.equal(pensionVerificationReady(d),true);assert.equal(pensionFields(d).some(f=>/^fund/.test(f.key)),false);
 assert.equal(pensionVerificationReady({...d,pensionVerification:{...d.pensionVerification,values:{...values,percent0:25}}}),false);
 assert.equal(pensionVerificationReady({...d,pensionVerification:{...d.pensionVerification,values:{...values,percent1:''}}}),false);
});
