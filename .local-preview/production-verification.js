import {pensionVerificationReady} from './pension-verification.js';
import {providerName,visibleCoverages} from '../frontend/src/lib/crmDisplay.js';

export const present=v=>v!=null&&String(v).trim()!=='';
export const todayInIsrael=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});
export function validDate(value) {
 const s=String(value||'');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
}
export function validPastDate(value,today=todayInIsrael()) {
 const s=String(value||'');return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s&&s<=today;
}
export const savingsProduct=d=>['פנסיה','השתלמות','גמל','גמל להשקעה','ביטוח מנהלים'].includes(d.targetCategory||d.productCategory);
export const pensionTransfer=d=>/^ניוד/.test(d.action||'')&&(d.targetCategory==='פנסיה'||!d.targetCategory&&(d.productCategory==='פנסיה'||/פנסיה/.test(d.action)));
export function productionFields(d) {
 const a=d.productionAgreement||{},expected=(key,value)=>present(value)?value:a[key];
 const fields=[{key:'company',label:'החברה / הגוף המנהל',expected:expected('company',d.target||d.sourceCompany),company:true}];
 if(savingsProduct(d)||/^ניוד/.test(d.action||'')) {
  // A missing agreed fee is not silently replaced by the current or zero fee.
  for(const [key,label] of [['depositFee','דמי ניהול מהפקדה (%)'],['balanceFee','דמי ניהול מצבירה (%)']])fields.push({key,label,expected:expected(key,d[key]),numeric:true,max:100});
  if(d.allocations?.length)d.allocations.forEach((r,i)=>fields.push({key:'percent'+i,label:'אחוז חלוקה — '+r.name,expected:r.percent,numeric:true,max:100}));
  else fields.push({key:'track',label:'מסלול השקעה',expected:expected('track',d.track)});
  if(/^ניוד/.test(d.action||''))fields.push({key:'received',label:'סכום שהתקבל (₪)',expected:d.transfer?.received,numeric:true});
 } else {
  fields.push({key:'premium',label:'פרמיה חודשית (₪)',expected:expected('premium',d.targetPremium),numeric:true,tolerance:2});
  if(['ביטוח חיים','מחלות קשות'].includes(d.productCategory))fields.push({key:'coverageAmount',label:'סכום הביטוח (₪)',expected:expected('coverageAmount',d.targetCoverage),numeric:true});
  const coverage=[...(d.riders||[]),...(d.riderDetail?[d.riderDetail]:[])].join(' · ');
  if(d.productCategory!=='ביטוח חיים')fields.push({key:'coverage',label:'הכיסויים והנספחים',expected:expected('coverage',d.productCategory==='בריאות'?coverage||d.agreedCoverage:d.agreedCoverage||coverage)});
  fields.push({key:'exclusions',label:'החרגות ותנאי קבלה',expected:expected('exclusions',d.agreedExclusions)});
 }
 if(['ביטוח חיים','ביטוח מנהלים'].includes(d.productCategory))fields.push({key:'beneficiaries',label:'מוטבים וחלקיהם לפי הוראות הלקוח',expected:expected('beneficiaries',d.agreedBeneficiaries)});
 fields.push({key:'effective',label:savingsProduct(d)?'תאריך קליטה בפועל':'תאריך תחילת הביטוח',expected:savingsProduct(d)?undefined:expected('effective',d.agreedEffective),date:true,allowFuture:['ביטוח חיים','בריאות'].includes(d.productCategory),compare:!savingsProduct(d)});
 if((d.targetCategory||d.productCategory)!=='פנסיה')fields.push({key:'policy',label:'מספר חשבון / פוליסה בפועל',actualOnly:true});
 return fields;
}
const text=v=>String(v??'').trim().replace(/\s+/g,' ');
export function productionFieldMatches(field,value,today=todayInIsrael()) {
 if(!present(value))return false;
 if(field.date)return (field.allowFuture?validDate(value):validPastDate(value,today))&&(!field.compare||present(field.expected)&&value===field.expected);
 if(field.actualOnly)return text(value).length>0;
 if(!present(field.expected))return false;
 if(field.numeric)return Number.isFinite(Number(value))&&Number(value)>=0&&(field.max==null||Number(value)<=field.max)&&Math.abs(Number(value)-Number(field.expected))<=(field.tolerance||0)+1e-9;
 return field.company?providerName(value)===providerName(field.expected):text(value)===text(field.expected);
}
export function productionVerificationReady(d) {
 if(pensionTransfer(d))return pensionVerificationReady(d);
 const v=d.productionVerification;
 const usesSupplement=productionFields({...d,productionAgreement:{}}).some(f=>!f.actualOnly&&(!f.date||f.compare)&&!present(f.expected));
 return (!usesSupplement||present(d.productionAgreement?.reference))&&!!v?.checkedAt&&validPastDate(v.checkedAt.slice(0,10))&&['company_site','company_document'].includes(v.source)&&present(v.reference)&&!!(d.policyDocument?.data||d.transfer?.document?.data)&&productionFields(d).every(f=>productionFieldMatches(f,v.values?.[f.key]));
}
export function recordProductionVerification(d,record) {
 if(d.completed)throw Error('המהלך הושלם; אין לשנות את בדיקת ההפקה ההיסטורית.');
 const verification={values:{...record.values},source:record.source,reference:String(record.reference||'').trim(),checkedAt:new Date().toISOString()};
 if(!productionVerificationReady({...d,productionVerification:verification}))throw Error(productionBlockers(d,record).join('\n')||'נדרש אימות תקף של פרטי ההפקה.');
 return {productionVerification:verification};
}
export function productionBlockers(d,record={}) {
 const reasons=[];
 for(const f of productionFields(d))if(!productionFieldMatches(f,record.values?.[f.key]))reasons.push(!present(record.values?.[f.key])?'חסר: '+f.label:'אי־התאמה: '+f.label+(f.tolerance?' — הפער המותר הוא עד 2 ₪ לכל כיוון':''));
 if(!(d.policyDocument?.data||d.transfer?.document?.data))reasons.push('חסר מסמך הביצוע / הפוליסה שהופקה');
 if(!['company_site','company_document'].includes(record.source))reasons.push('יש לבחור מקור בדיקה');
 if(!present(record.reference))reasons.push('יש לתאר על סמך איזה מסמך או מידע בוצעה הבדיקה');
 if(productionFields({...d,productionAgreement:{}}).some(f=>!f.actualOnly&&(!f.date||f.compare)&&!present(f.expected))&&!present(d.productionAgreement?.reference))reasons.push('חסר מקור לתנאים שסוכמו');
 return reasons;
}
export function productionProductValues(d) {
 if(!productionVerificationReady(d))return {};
 const v=pensionTransfer(d)?d.pensionVerification.values:d.productionVerification.values;
 const riders=[...(d.riders||[]),...(d.riderDetail?[d.riderDetail]:[])];
 const structuredRiders=(d.productCategory==='בריאות'||!present(d.agreedCoverage))&&riders.length&&text(v.coverage)===text(riders.join(' · '));
 const coverage=d.productCategory==='ביטוח חיים'&&present(v.coverageAmount)?[{name:d.agreedCoverage||d.productionAgreement?.coverage||'ביטוח חיים',amount:Number(v.coverageAmount)}]:present(v.coverage)?structuredRiders?riders.map(name=>({name})):[{name:v.coverage,...(present(v.coverageAmount)?{amount:Number(v.coverageAmount)}:{})}]:undefined;
 return {company:v.company,asOf:v.effective||v.date,...(present(v.policy)?{policy:v.policy}:{}),...(present(v.depositFee)?{depositFee:Number(v.depositFee)}:{}),...(present(v.balanceFee)?{balanceFee:Number(v.balanceFee)}:{}),...(present(v.premium)?{premium:Number(v.premium)}:{}),...(present(v.beneficiaries)?{beneficiaries:v.beneficiaries}:{}),...(present(v.track)?{track:v.track}:{}),...(coverage?{coverage:visibleCoverages(coverage)}:{}),...(present(v.exclusions)?{exclusions:v.exclusions}:{})};
}
