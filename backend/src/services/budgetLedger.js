import XLSX from 'xlsx';
export function amount(value){
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 let s=String(value??'').trim().replace(/[₪,\s\u200e\u200f]/g,'');
 if(/^\(.*\)$/.test(s))s='-'+s.slice(1,-1);
 return s!==''&&/^-?\d+(\.\d+)?$/.test(s)?Number(s):null;
}
export function date(value){
 let s=String(value??'').trim();
 if(typeof value==='number'){const d=XLSX.SSF.parse_date_code(value);if(!d)return null;s=`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}
 const m=s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);if(m)s=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
 const d=new Date(s+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s?s:null;
}
const text=v=>String(v??'').replace(/[\u200e\u200f]/g,'').replace(/\s+/g,' ').trim();
export const movementKey=r=>JSON.stringify([r.kind,r.date,Math.round(Number(r.amount)*100),text(r.label)]);
export function parseBudget(buffer,source){
 if(!['discount','cal','max','cash'].includes(source))throw Error('יש לבחור מקור לקובץ');
 const wb=XLSX.read(buffer,{type:'buffer'}),items=[],issues=[];
 for(const sheetName of wb.SheetNames){
  if(sheetName.includes('סיכום'))continue;
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:''});
  const hi=rows.findIndex(r=>r.some(v=>text(v).includes('תאריך'))&&r.some(v=>/סכום|חובה|זכות/.test(text(v))));
  if(hi<0){if(rows.some(r=>r.some(v=>text(v))))issues.push(`${sheetName}: לא זוהתה טבלת תנועות`);continue;}
  const h=rows[hi].map(text),find=pattern=>h.findIndex(v=>pattern.test(v));
  const di=find(/תאריך.*עסקה/)>=0?find(/תאריך.*עסקה/):find(/תאריך/);
  const li=find(/שם.*עסק|תיאור|פרטים|שם.*תנועה|מקור/),ci=find(/4 ספרות|כרטיס/),ki=find(/^סוג$/),currency=find(/^מטבע חיוב$/);
  let ai=find(/סכום.*חיוב|סכום.*שקל|זכות\/חובה/);if(ai<0)ai=find(/^סכום|סכום.*עסקה/);
  const debit=find(/חובה/),credit=find(/זכות/);
  const detected=debit>=0||credit>=0?'discount':ki>=0?'cash':currency>=0?'max':ci>=0?'cal':null;
  if(detected&&detected!==source)throw Error('הקובץ לא מתאים למקור שנבחר. יש לבחור '+({discount:'דיסקונט',cash:'מזומן',max:'מקס',cal:'כאל'}[detected]));
  if(li<0||(ai<0&&(debit<0||credit<0))||(source==='cash'&&ki<0)){issues.push(`${sheetName}: חסרות עמודות תיאור, סכום או סוג תנועה`);continue;}
  const isBank=source==='discount'&&!h.some(v=>/בית עסק|כרטיס/.test(v));
  let future=false;
  for(let i=hi+1;i<rows.length;i++){
   const row=rows[i];if(!row.some(v=>text(v)))continue;
   if(text(row[0])==='תנועות עתידיות'){future=true;continue;}
   if(text(row[0])==='N/A')continue;
   if(text(row[di]).includes('תאריך'))continue;
   if(row.some(v=>/^סה[״"']?כ|^סך הכל/.test(text(v))))break;
   const dt=date(row[di]),label=text(row[li]);
   if(currency>=0&&text(row[currency])&&!/^(₪|ILS|ש["״]?ח|שקל|שקלים)$/i.test(text(row[currency]))){issues.push(`${sheetName}, שורה ${i+1}: סכום חיוב במטבע זר דורש המרה לשקלים`);continue;}
   let value=ai>=0?amount(row[ai]):(amount(row[credit])??0)-(amount(row[debit])??0);
   if(!dt||!label||value===null||value===0){issues.push(`${sheetName}, שורה ${i+1}: תאריך, תיאור או סכום לא תקינים`);continue;}
   let kind=isBank?(value<0?'expense':'income'):'expense';
   if(source==='cash'){kind=text(row[ki])==='הוצאה'?'expense':text(row[ki])==='הכנסה'?'income':null;if(!kind||value<=0){issues.push(`${sheetName}, שורה ${i+1}: סוג חייב להיות הוצאה או הכנסה וסכום חיובי`);continue;}}
   if(isBank)value=Math.abs(value);
   let warning='';
   if(isBank&&/כרטיס|ויזה|כאל|מקס איט|ישראכרט|חיוב ממקס/.test(label))warning='חיוב כרטיס בבנק — יש לספור את פירוט העסקאות בכרטיס בלבד';
   else if(isBank&&/העבר|משיכ|כספומט|הלוואה|פיקדון|פקדון/.test(label))warning='ייתכן שזו העברה, משיכת מזומן או מימון — יש לבדוק לפני ספירה בתקציב';
   if(future)warning='תנועה עתידית — לא נכללת אוטומטית בהוצאות בפועל';
   if(row.some(v=>/עסקה בקליטה|בתהליך קליטה/.test(text(v))))warning='עסקה בקליטה — לא נכללת אוטומטית עד להשלמת החיוב';
   const card=ci>=0?text(row[ci]).match(/\d{4}$/)?.[0]:null;
   items.push({id:String(items.length),kind,date:dt,label,amount:Math.round(value*100)/100,payment_method:source==='cash'?'מזומן':isBank?'בנק דיסקונט':source==='max'?'מקס כרטיס אשראי':'כאל כרטיס אשראי',card_number:card||null,warning,include:!warning});
  }
 }
 if(!items.length)throw Error('לא נמצאו תנועות בפורמט נתמך. '+issues.slice(0,2).join('; '));
 if(items.length>3000)throw Error('ניתן לייבא עד 3,000 תנועות בכל קובץ');
 return {items,issues};
}
export function annotateDuplicates(items,existing){
 const counts=new Map();for(const r of existing){const k=movementKey(r);counts.set(k,(counts.get(k)||0)+1);}
 const seen=new Map();return items.map(r=>{const k=movementKey(r),occurrence=(seen.get(k)||0)+1;seen.set(k,occurrence);const n=counts.get(k)||0;return {...r,existingCount:n,duplicate:n>=occurrence,include:r.include&&n<occurrence};});
}
