// Defaults fill absent values only: zero and an intentionally cleared field survive.
export function depositDefaults(value={}) {
 return {...value,...Object.fromEntries(Object.entries({employee:6,employer:6.5,severance:6}).filter(([key])=>value[key]==null))};
}
export function pensionFields(d) {
 const fields=[{key:'company',label:'הגוף המנהל',expected:d.target},
  {key:'depositFee',label:'דמי ניהול מהפקדה (%)',expected:d.depositFee,numeric:true},
  {key:'balanceFee',label:'דמי ניהול מצבירה (%)',expected:d.balanceFee,numeric:true}];
 if(d.allocations?.length)d.allocations.forEach((a,i)=>fields.push(
  {key:`percent${i}`,label:`אחוז חלוקה — ${a.name}`,expected:a.percent,numeric:true}));
 else fields.push({key:'track',label:'מסלול השקעה',expected:d.track});
 fields.push({key:'received',label:'סכום שהתקבל (₪)',expected:d.transfer?.received,numeric:true},
  {key:'date',label:'תאריך קליטה בפועל',date:true});
 return fields;
}
const present=v=>v!=null&&String(v).trim()!=='';
export function pensionFieldMatches(field,value,today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'})) {
 if(!present(value))return false;
 if(field.date){const s=String(value);return /^\d{4}-\d{2}-\d{2}$/.test(s)&&s<=today&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
 if(!present(field.expected))return false;
 if(field.numeric)return Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)===Number(field.expected);
 return String(value).trim()===String(field.expected).trim();
}
export function pensionVerificationReady(d) {
 const check=d.pensionVerification;
 return !!check?.checkedAt&&pensionFields(d).every(f=>pensionFieldMatches(f,check.values?.[f.key]));
}
