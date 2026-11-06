import {openingRequired,openingDue} from './pension-flow.js';
import {clientUpsell} from './client-upsell.js';
import {payrollReplyPending,payrollReplyDue} from './payroll-reply.js';
import {transferNext} from './workflow-transfer-stages.js';
import {isPensionTransfer} from './workflow-process.js';
import {pensionVerificationReady} from './pension-verification.js';
import {businessDate, israelDate, taskList, actionKind, cancellationReminder,followupTaskDone} from './workflow-process.js';

import {depositDifference,changeRequests} from './workflow-detail-rules.js';
import {appointmentTask,changeTaskReady,agentAppointmentReady,changeWorkflowReady} from './agent-change-rules.js';
import {feeAgreementPending} from './fee-change-agreement.js';
import {informationAppointmentTask} from './info-appointment.js';
import {consolidationReadyForUpdate} from './workflow-consolidation.js';
export const taskLinkHash=key=>'#task='+encodeURIComponent(key);
export function resolveTaskLink(clients,hash){
  if(!hash.startsWith('#task='))return null;
  try{return homeTasks(clients).find(t=>t.id===decodeURIComponent(hash.slice(6)))||null;}catch{return null;}
}
// Read-only projections of the same customer records. Never create a second task store.
export function homeTasks(clients, today=israelDate()) {
  const result=[];
  for(const c of clients) {
    const pendingMessages=new Set();
    const add=(key,title,tab='ביצוע ומעקב',due=today,urgent=false,detail='')=>result.push({id:`${c.id}:${key}`,clientId:c.id,clientName:c.name,title,tab,due,urgent,detail});
    const upsell=clientUpsell(c);
    if(upsell)add(upsell.key,upsell.title,'ביצוע ומעקב',upsell.due,false,upsell.subjects.join(' · '));
    for(const t of c.operationalTasks||[])if(t.status!=='done')add('operational:'+t.id,t.kind,'ביצוע ומעקב',t.due||today,false,t.note);
    if(!c.call && !(c.decisions||[]).length) add('intro','שיחת היכרות וקביעת פגישה','סקירה');
    else if(!(c.products||[]).length) add('info','להשלים פרטים ולעקוב אחרי בקשות מידע','פרטים והרשאות');
    if(c.meetingDone&&!c.summarySent) add('summary','בדיקה ושליחת סיכום הפגישה בדמו','פגישה וסיכום');
    for(const m of c.messages||[]) if(!m.applied&&!m.ignored) add(`mail:${m.id}`,'בדיקת עדכון שהתקבל','מיילים',today,false,m.subject);
    for(const group of c.consolidations||[])if(consolidationReadyForUpdate(c,group))add(`consolidation:${group.id}:update`,'עדכון הלקוח וסיום איחוד הקופות','ביצוע ומעקב',today,false,group.agreement.target);
    for(const d of c.decisions||[]) {
      const information=informationAppointmentTask(d);
      if(information)add(`${d.id}:${information.key}`,information.title,'ביצוע ומעקב',information.due||today,information.urgent);
      if(d.completed||d.stopped||['להשאיר ללא שינוי','לא מעוניין כרגע','לא הוצע / לא נדון בפגישה'].includes(d.action)) continue;
      const detail=[(c.products||[]).find(p=>p.id===d.productId)?.category,d.target].filter(Boolean).join(' · ');
      const push=(key,title,due=today,urgent=false)=>add(`${d.id}:${key}`,title,'ביצוע ומעקב',due,urgent,detail);
      if(d.signatureSent&&!d.signatureMessageSentAt){const batch=d.signatureBatchId||d.id;if(!pendingMessages.has(batch)){push('whatsapp','שליחת וואטסאפ — המסמכים נשלחו לחתימה');pendingMessages.add(batch);}}
      if(depositDifference(d).open)push('deposit-gap','בירור פער בהפקדה: '+Math.abs(depositDifference(d).gap)+' ₪',today,true);
      const appointment=appointmentTask(d);
      if(appointment)push('appointment-check',appointment.title,appointment.due||today,appointment.urgent);
      if(agentAppointmentReady(d)){
        if(feeAgreementPending(d))push('fee-agreement','בירור ההחלטה: האם סוכמה בקשת הנחה');
        for(const t of changeRequests(d))if(!changeTaskReady(d,t.key)&&!t.waiting&&(t.submittedAt||d.agentAppointment?.acceptedAt))push('change:'+t.key,t.clientDecisionRequired?'יצירת קשר עם הלקוח — נדרשת החלטה על '+t.title:t.title,t.due||today,t.clientDecisionRequired||!!d.changeTasks?.[t.key]?.inquiryRequired);
      }
      if(d.sent&&['agent','change'].includes(actionKind(d.action))&&(!agentAppointmentReady(d)||!changeWorkflowReady(d)))continue;
      const cancellation=cancellationReminder(d,today);
      if(cancellation)push(cancellation.key,cancellation.title,cancellation.due||today,cancellation.urgent);
      if(d.cancellationUrgent&&!cancellation&&!d.tasks?.cancelCheck?.done) {push('cancel-urgent','בירור דחוף: ביטול הפוליסה הישנה לא הושלם',today,true);continue;}
      if(d.missing) {push('missing','בקשת המסמכים החסרים מהלקוח');continue;}
      if(d.underwritingPending) {push('underwriting','טיפול בתנאי החיתום');continue;}
      if(openingRequired(d)){push('opening','וידוא פתיחת הקופה וקבלת המסמכים בחברה',openingDue(d)||today);continue;}
      if(actionKind(d.action)==='transfer'&&payrollReplyPending(d))push('payroll-reply','וידוא אישור מחשבת השכר על עדכון ההפקדות',payrollReplyDue(d)||today);
      if(d.consolidationId&&d.produced)continue;
      if(isPensionTransfer(d)&&d.fundsConfirmed){if(!depositDifference(d).open)push(pensionVerificationReady(d)?'pension-close':'pension-verify',pensionVerificationReady(d)?d.consolidationId?'אימות וקליטת מקור באיחוד הקופות':'עדכון הלקוח וסיום ניוד הפנסיה':'בדיקת פרטי ההפקה בפנסיה מול הסיכום');continue;}
      if(d.produced) {
        const next=taskList(d).find(t=>!followupTaskDone(d,t.key));
        if(next) {if(next.key!=='cancelCheck')push(next.key,next.title,next.due||today);}
        else push('close','בדיקת סיום המהלך');
      } else if(actionKind(d.action)==='transfer'&&d.sent&&!d.fundsConfirmed){const next=transferNext(d);push('funds:'+next.stage,next.title,next.due||today);}
      else if(d.approved) push('verify','בדיקת אישור החברה מול מה שסוכם');
      else if(d.sent) {if(!appointment)push('company','מעקב תשובת החברה',d.sentAt?businessDate(d.sentAt,actionKind(d.action)==='agent'?10:5):'');}
      else if(d.signed) push('sent','וידוא שמסמכי הפעולה נשלחו לחברה');
      else if(d.signatureSent) {if(d.signatureMessageSentAt)push('signature','מעקב חתימה',d.signatureSentAt?businessDate(d.signatureSentAt,2):'');}
      else if(c.summarySent) push('kit','הכנת קיט הפעולה ושליחה לחתימה');
    }
  }
  return result.sort((a,b)=>Number(b.urgent)-Number(a.urgent)||(a.due||'9999').localeCompare(b.due||'9999')||a.clientName.localeCompare(b.clientName,'he'));
}
export function homePartition(tasks,today,limit=5) {
  const due=tasks.filter(t=>t.urgent||!t.due||t.due<=today);
  const future=tasks.filter(t=>!t.urgent&&t.due&&t.due>today);
  const visible=due.filter((t,i)=>t.urgent||i<limit);
  return {due,future,visible,hidden:due.length-visible.length};
}
