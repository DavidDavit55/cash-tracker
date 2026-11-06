export function initialAllocations(decision){
 if(decision?.allocations?.length)return decision.allocations.map(r=>({fundId:String(r.fundId),percent:String(r.percent)}));
 return [{fundId:String(decision?.fundId||''),percent:'100'}];
}
export const allocationText=rows=>(rows||[]).map(r=>`${r.percent}% ${r.name} (מסלול ${r.fundId})`).join(' · ');
export function validateAllocations(parts,catalogue,manager){
 const total=parts.reduce((sum,r)=>sum+(Number.isFinite(Number(r.percent))?Math.round(Number(r.percent)*100):0),0)/100;
 const fail=error=>({valid:false,total,error});
 if(!manager||!parts.length)return fail('בחר גוף מנהל ומסלול');
 if(parts.some(r=>!r.fundId))return fail('בחר מסלול בכל שורה');
 if(new Set(parts.map(r=>String(r.fundId))).size!==parts.length)return fail('אין לבחור את אותו מסלול פעמיים');
 const funds=parts.map(p=>catalogue.find(r=>String(r.id)===String(p.fundId)&&r.manager===manager));
 if(funds.some(r=>!r))return fail('יש לבחור מסלולים מאותו גוף מתוך הקטלוג');
 if(new Set(funds.map(r=>r.classification).filter(Boolean)).size>1)return fail('אין לשלב סוגי קרנות שונים באותה חלוקה');
 if(parts.some(r=>!/^\d+(\.\d{1,2})?$/.test(String(r.percent))||Number(r.percent)<=0||Number(r.percent)>100))return fail('הזן אחוז גדול מאפס ועד 100, עד שתי ספרות אחרי הנקודה');
 if(total!==100)return fail('החלוקה חייבת להסתכם ב־100%');
 return {valid:true,total,error:'',allocations:parts.map((p,i)=>({fundId:String(funds[i].id),name:funds[i].name,percent:Number(p.percent),manager:funds[i].manager,classification:funds[i].classification,reportPeriod:funds[i].reportPeriod}))};
}
