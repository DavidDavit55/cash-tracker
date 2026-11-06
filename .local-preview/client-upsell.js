import {israelDate} from './workflow-process.js';

const inactive=d=>d.stopped||['להשאיר ללא שינוי','לא מעוניין כרגע','לא הוצע / לא נדון בפגישה'].includes(d.action);
const token=d=>JSON.stringify([d.id,d.completedAt]);

// One read-only projection per client, shared by the CRM and Google Tasks.
// Never infer completion from production, a signature or a company email.
export function clientUpsell(client){
 const work=(client.decisions||[]).filter(d=>!inactive(d));
 if(!work.length||work.some(d=>!d.completed||!d.completedAt||!israelDate(d.completedAt)||new Date(d.completedAt)>new Date()))return null;
 if((client.consolidations||[]).some(g=>g.sourceDecisionIds?.length&&!g.completion))return null;
 const covered=new Set((client.upsellHistory||[]).flatMap(h=>h.completionTokens||[]));
 const pending=work.filter(d=>!covered.has(token(d)));
 if(!pending.length)return null;
 const due=work.map(d=>israelDate(d.completedAt)).sort().at(-1);
 const subjects=[];
 for(const p of client.products||[]){
  if(p.archived)continue;
  const decisions=(client.decisions||[]).filter(d=>d.productId===p.id);
  if(decisions.some(d=>d.action!=='לא הוצע / לא נדון בפגישה'))continue;
  subjects.push(p.category||p.name);
 }
 for(const d of client.decisions||[]){
  if(d.action==='לא הוצע / לא נדון בפגישה'&&!(client.decisions||[]).some(other=>other.productId===d.productId&&other.action!=='לא הוצע / לא נדון בפגישה'))subjects.push(d.productCategory||d.proposedProduct?.category);
 }
 return {key:'client-upsell',title:'שיחת אפסייל מרוכזת לאחר השלמת הטיפול',due,completionTokens:work.map(token).sort(),subjects:[...new Set(subjects.filter(Boolean))]};
}

export function completeClientUpsell(client,{outcome,note},expectedTokens,at=new Date().toISOString()){
 const task=clientUpsell(client);
 if(!task||JSON.stringify(task.completionTokens)!==JSON.stringify(expectedTokens))throw Error('הטיפול בתיק השתנה. יש לפתוח מחדש את משימת האפסייל.');
 if(!['נבדקו צרכים נוספים','הלקוח לא מעוניין','אין צורך בהצעה נוספת'].includes(outcome)||!note?.trim())throw Error('יש לבחור תוצאה ולתעד את השיחה או הבדיקה שבוצעה.');
 if(!israelDate(at)||new Date(at)>new Date())throw Error('מועד התיעוד אינו תקין.');
 return {...client,upsellHistory:[...(client.upsellHistory||[]),{at,outcome,note:note.trim(),completionTokens:task.completionTokens,subjects:task.subjects}]};
}
