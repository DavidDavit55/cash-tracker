// Pure review schema. Mirrored in frontend/src/lib/productReview.js; parity tested.
export const REVIEW_STATES = {unchecked:'טרם נבדק', good:'נבדק ונמצא מתאים', improve:'מומלץ לשפר', action:'נדרש טיפול', noCoverage:'חסר כיסוי', missing:'חסר מידע', na:'לא רלוונטי'};
export const lifeReviewProduct=p=>p.category==='ביטוח חיים'||p.type==='life';
export const reviewStateLabel=(product,parameter,state)=>lifeReviewProduct(product)&&parameter==='premium'&&state==='action'?'הזדמנות להוזיל':REVIEW_STATES[state];
export const HEALTH_CHECK_KEY = 'portfolio:basic-health';
export const PARAMETERS = {healthTransplants:'השתלות וטיפולים מחוץ לארץ', healthDrugs:'תרופות מחוץ לסל', healthSurgery:'ניתוחים וטיפולים מחוץ לארץ',depositFee:'דמי ניהול מהפקדה', balanceFee:'דמי ניהול מצבירה', track:'מסלול השקעה', deposits:'הפקדות', coverage:'כיסוי ביטוחי', premium:'עלות הביטוח', beneficiaries:'מוטבים', exclusions:'חריגים ותנאי הפוליסה'};
export function reviewProducts(data={}) {
 const seen=new Map();
 for (const [source,items] of [['pension',data.pension_data],['insurance',data.insurance_data],['insurance',data.har_bituach_data]]) {
  for (const p of items||[]) {
   const kind=source==='pension'||p.type==='managers'?'savings':'insurance';
   const key=JSON.stringify([kind,String(p.provider||'').trim(),String(p.type||''),String(p.id??'')]);
   if(seen.has(key)) continue;
   const parameters=kind==='insurance'?['coverage','premium','exclusions','beneficiaries']:['depositFee','balanceFee','track','deposits',...(p.type==='pension'?['coverage']:p.type==='managers'?['coverage','beneficiaries']:[])];
   seen.set(key,{key,type:p.type,category:p.category,name:p.name||p.productType||'מוצר ללא שם',provider:p.provider||'',number:String(p.id??''),balance:p.balance,values:{depositFee:p.feeFromDeposit,balanceFee:p.feeFromAccumulation,track:p.investmentTrack,deposits:p.monthlyDeposit,premium:p.monthlyPremium},parameters});
  }
 }
 return [...seen.values(),{key:HEALTH_CHECK_KEY,name:'בדיקת כיסוי בריאות בסיסי',scope:'portfolio',provider:'',number:'',parameters:['healthTransplants','healthDrugs','healthSurgery']}];
}
export function productState(product, assessments={}) {
 const states=product.parameters.map(k=>assessments[product.key]?.[k]?.status||'unchecked');
 if(states.includes('action')||states.includes('noCoverage')) return 'action';
 if(states.includes('improve')) return 'improve';
 if(states.some(s=>s==='unchecked'||s==='missing')) return 'unknown';
 if(states.every(s=>s==='na')) return 'na';
 return 'good';
}
export function reviewSummary(products,assessments={}) {
 const counts={good:0,improve:0,action:0,unknown:0,na:0};let reviewed=0;
 for(const p of products){counts[productState(p,assessments)]++;if(p.parameters.every(k=>['good','improve','action','noCoverage','na'].includes(assessments[p.key]?.[k]?.status)))reviewed++;}
 return {counts,reviewed,total:products.length};
}
export function validateAssessments(value,products,publish=false) {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>500)throw new Error('מבנה בדיקת מוצרים לא תקין');
 const result={};
 for(const [key,entries] of Object.entries(value)){
  const p=products.find(p=>p.key===key);if(!p)throw new Error('מוצר אינו שייך לגרסת התיק הנוכחית');
  if(!entries||typeof entries!=='object'||Array.isArray(entries))throw new Error('פרמטרים לא תקינים');
  result[key]={};
  for(const [param,entry] of Object.entries(entries)){
   if(!p.parameters.includes(param)||!entry||!Object.hasOwn(REVIEW_STATES,entry.status)||typeof entry.note!=='string'||entry.note.length>2000)throw new Error('סטטוס או פרמטר לא תקין');
   if(publish&&['improve','action','noCoverage','missing'].includes(entry.status)&&!entry.note.trim())throw new Error('יש להסביר ממצאים לשיפור, לטיפול או מידע חסר לפני פרסום');
   result[key][param]={status:entry.status,note:entry.note.trim()};
   if(param==='premium'&&['action','improve'].includes(entry.status)) {
    const supplied=entry.proposedPremium!=null&&String(entry.proposedPremium).trim()!=='';
    if(publish&&!supplied)throw new Error('יש להזין פרמיה מוצעת לפני פרסום המלצה לטיפול בעלות הביטוח');
    if(supplied){const premium=Number(entry.proposedPremium);if(!['number','string'].includes(typeof entry.proposedPremium)||!Number.isFinite(premium)||premium<0)throw new Error('הפרמיה המוצעת אינה תקינה');result[key][param].proposedPremium=premium;}
   }
   if(param==='premium'&&lifeReviewProduct(p)&&['action','improve'].includes(entry.status)) {
    const supplied=entry.proposedCoverage!=null&&String(entry.proposedCoverage).trim()!=='';
    if(publish&&!supplied)throw new Error('יש להזין סכום ביטוח מוצע לצד הפרמיה לפני פרסום');
    if(supplied){const amount=Number(entry.proposedCoverage);if(!['number','string'].includes(typeof entry.proposedCoverage)||!Number.isFinite(amount)||amount<=0)throw new Error('סכום הביטוח המוצע אינו תקין');result[key][param].proposedCoverage=amount;}
   }
   if(['depositFee','balanceFee'].includes(param)&&entry.status==='improve') {
    const supplied=entry.proposedFee!==undefined&&entry.proposedFee!==null&&String(entry.proposedFee).trim()!=='';
    if(publish&&!supplied)throw new Error('יש להזין דמי ניהול מוצעים לפני פרסום');
    if(supplied){
     const rate=Number(entry.proposedFee);
     if(!['number','string'].includes(typeof entry.proposedFee)||!Number.isFinite(rate)||rate<0||rate>100)throw new Error('דמי הניהול המוצעים אינם תקינים');
     result[key][param].proposedFee=rate;
    }
   }
  }
 }
 for(const p of products)for(const param of ['depositFee','balanceFee'])if(result[p.key]?.[param])result[p.key][param].note=feeRecommendation(param,result[p.key][param],p.values,result[p.key]);
 return result;
}
export function feeRecommendation(param,entry,values={},entries={}) {
 const has=v=>v!==undefined&&v!==null&&String(v).trim()!==''&&Number.isFinite(Number(v));
 const label=PARAMETERS[param];
 if(entry.status==='good')return `${label} נבדקו ונמצאו טובים. מומלץ לשמור על התנאים הקיימים.`;
 if(entry.status!=='improve')return entry.note||'';
 const deposit=entries.depositFee,balance=entries.balanceFee;
 if(deposit?.status==='improve'&&balance?.status==='improve'&&has(deposit.proposedFee)&&has(balance.proposedFee)&&has(values.depositFee)&&has(values.balanceFee)&&Number(deposit.proposedFee)>Number(values.depositFee)&&Number(balance.proposedFee)<Number(values.balanceFee))return `מומלץ לבחון שינוי במבנה דמי הניהול: העלאת דמי הניהול מהפקדה מ־${values.depositFee}% ל־${deposit.proposedFee}%, לצד הפחתת דמי הניהול מצבירה מ־${values.balanceFee}% ל־${balance.proposedFee}%. יש לבחון את הכדאיות הכוללת לפי הצבירה, ההפקדות ומשך ההטבות; ההפחתה ברכיב הצבירה לבדה אינה מבטיחה חיסכון.`;
 if(!has(entry.proposedFee))return `${label}: מומלץ לבחון שינוי בתנאים. יש להשלים את דמי הניהול המוצעים.`;
 const direction=!has(values[param])?'שינוי':Number(entry.proposedFee)<Number(values[param])?'הפחתה':Number(entry.proposedFee)>Number(values[param])?'העלאה':'שמירה על השיעור';
 return `${label}: מוצעת ${direction} ל־${entry.proposedFee}%. יש לבחון את שני רכיבי דמי הניהול יחד לפני קביעה שהחלופה משתלמת.`;
}
