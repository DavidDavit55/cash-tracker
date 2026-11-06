import {pensionVerificationReady} from './pension-verification.js';
import {depositDifference} from './workflow-detail-rules.js';
import {productionVerificationReady,validPastDate} from './production-verification.js';
import {agentAppointmentReady,changeWorkflowReady} from './agent-change-rules.js';
export const isPensionTransfer=d=>actionKind(d.action)==='transfer'&&(d.targetCategory==='פנסיה'||!d.targetCategory&&(d.productCategory==='פנסיה'||/פנסיה/.test(d.action)));
export const pensionTransferReady=d=>isPensionTransfer(d)&&pensionVerificationReady(d)&&!d.stopped&&!d.missing&&!d.underwritingPending&&!depositDifference(d).open&&d.sent&&d.signatureSent&&d.signed&&signedKit(d)&&transferReady(d);
export const actionOptions=['להשאיר ללא שינוי','מינוי סוכן ללא שינוי בתנאים','מינוי סוכן וביצוע השינויים שבסיכום','ניוד קרן פנסיה בהתאם לסיכום','ניוד קרן השתלמות בהתאם לסיכום','ניוד קופת גמל בהתאם לסיכום','הצטרפות למוצר חדש בהתאם לסיכום','החלפת מוצר קיים — שחלוף בהתאם לסיכום'];
export function actionKind(action){return /שחלוף/.test(action)?'replace':/^ניוד/.test(action)?'transfer':/^הצטרפות/.test(action)?'new':action==='מינוי סוכן ללא שינוי בתנאים'?'agent':action==='מינוי סוכן וביצוע השינויים שבסיכום'?'change':'other';}
export const isTarget=a=>['replace','transfer','new'].includes(actionKind(a));
export const healthRiders=['השתלות וטיפולים מיוחדים בחו״ל','תרופות מחוץ לסל','ניתוחים וטיפולים מחליפי ניתוח בחו״ל','ניתוחים בישראל — לפי המסלול שסוכם','שירותים אמבולטוריים'];
export const productionChecks=['כל הכיסויים שסוכמו מופיעים','סכומי הביטוח והפרמיה הרלוונטיים תואמים','החרגות ותנאי חיתום תואמים לאישור הלקוח','תאריך תחילת הביטוח נכון','מסמך הפוליסה נשמר בתיק'];
export function productionChecksFor(d){return actionKind(d.action)==='transfer'?['הקרן והגוף המנהל תואמים לסיכום','דמי הניהול תואמים לתנאים שסוכמו','מסלולי ההשקעה והחלוקה תואמים לסיכום','תאריך הקליטה ומספר החשבון נכונים','סכום הניוד נבדק ומסמך הניוד נשמר']:productionChecks;}
export function kitFor(d){return [{id:'join',name:actionKind(d.action)==='agent'?'בקשת מינוי סוכן':'קיט מסמכי הפעולה'},...(actionKind(d.action)==='replace'?[{id:'cancel',name:'נספח א׳ או ג׳ לביטול — לפי המקרה'},{id:'info',name:'מינוי סוכן לקבלת מידע בלבד על הפוליסה הישנה'}]:[])];}
export function kitReady(d){return kitFor(d).every(x=>d.kit?.[x.id]?.ready&&d.kit[x.id].file?.data)&&(actionKind(d.action)!=='replace'||['א','ג'].includes(d.cancelAnnex));}
export function smsKitRecorded(d){return d.sms2010?.status==='signed_and_sent'&&(d.sms2010?.simulated===true||d.sms2010?.manual===true&&validPastDate(d.sms2010.sentDate)&&(d.sms2010.confirmedBySubmit===true||!!d.sms2010.reference?.trim()))&&!!d.sms2010?.recordedAt&&d.signed&&d.sent;}
export function recordSmsKit(d,at=new Date().toISOString()){
 if(actionKind(d.action)==='replace'&&!['א','ג'].includes(d.cancelAnnex))throw Error('יש לבחור את נספח הביטול הכלול בקיט.');
 return {signatureSent:true,signatureSentAt:d.signatureSentAt||at,signed:true,sent:true,sentAt:at,sentBy:'עדכון SMS 2010 (דמו)',sms2010:{status:'signed_and_sent',recordedAt:at,simulated:true,cancelAnnex:d.cancelAnnex||null}};
}
export function recordExternalKit(d,data){
 if(d.signatureSentAt&&data.date<String(d.signatureSentAt).slice(0,10))throw Error('תאריך החתימה אינו יכול להיות קודם לשליחה לחתימה.');
 if(d.sent||d.completed||!validPastDate(data.date))throw Error('יש להזין מועד שליחה שבוצעה; אין לתעד תאריך עתידי או שליחה כפולה.');
 if(d.productCategory!=='בריאות'&&!data.identityAttached)throw Error('יש לוודא שצילום ת״ז צורף לטפסי הקיט.');
 if(actionKind(d.action)==='replace'&&!['א','ג'].includes(d.cancelAnnex))throw Error('יש לבחור את נספח הביטול שנכלל בקיט החתום.');
 const at=new Date().toISOString();return {signatureSent:true,signatureSentAt:d.signatureSentAt||at,signed:true,sent:true,sentAt:data.date+'T12:00:00Z',sentBy:'תיעוד ידני — SMS 2010',sms2010:{status:'signed_and_sent',recordedAt:at,manual:true,simulated:false,sentDate:data.date,confirmedBySubmit:true,...(data.reference?.trim()?{reference:data.reference.trim()}:{}),identityAttached:!!data.identityAttached,cancelAnnex:d.cancelAnnex||null}};
}
export function recordSignatureDispatch(d,date){
 if(d.signatureSent||d.sent||d.completed||!validPastDate(date))throw Error('יש להזין תאריך שליחה לחתימה שבוצעה בפועל.');
 if(actionKind(d.action)==='replace'&&!['א','ג'].includes(d.cancelAnnex))throw Error('יש לבחור נספח ביטול לפני השליחה.');
 return {signatureSent:true,signatureSentAt:date+'T12:00:00Z',messagePrepared:false,messageText:'',messageKitIds:undefined};
}
export function signedKit(d){return (smsKitRecorded(d)&&(actionKind(d.action)!=='replace'||['א','ג'].includes(d.cancelAnnex)&&d.sms2010.cancelAnnex===d.cancelAnnex))||(kitReady(d)&&kitFor(d).every(x=>d.kit[x.id].signedAt));}
export function transferReady(d){if(depositDifference(d).open||d.pensionFlow?.version===1&&!d.pensionFlow.openingVerified)return false;const f=d.transfer||{},expected=Number(f.salary)*(Number(f.employee||0)+Number(f.employer||0)+Number(f.severance||0))/100;const tolerance=f.inactive?50:expected;return ((d.targetCategory||d.productCategory)==='פנסיה'||!d.targetCategory&&!d.productCategory&&/פנסיה/.test(d.action)||!!(d.policy||d.productionVerification?.values?.policy)?.trim())&&f.verified&&d.fundsConfirmed&&d.sourceBalance!=null&&d.sourceBalance!==''&&Number.isFinite(Number(d.sourceBalance))&&Number(d.sourceBalance)>=0&&f.received!==''&&Number.isFinite(Number(f.received))&&Number(f.received)>=0&&f.document?.data&&(f.inactive||Number.isFinite(expected)&&expected>0)&&[f.employee,f.employer,f.severance].every(x=>x==null||x===''||Number(x)>=0&&Number(x)<=100)&&(Math.abs(Number(f.received)-d.sourceBalance)<=tolerance||!!f.resolution?.trim())&&(!(f.requiresDeposit||f.inactive===false)||validPastDate(f.depositDate)&&f.depositActual!=null&&f.depositActual!==''&&Number.isFinite(Number(f.depositActual))&&Number(f.depositActual)>0&&f.payrollSent);}
// Demo calendar: Sunday–Thursday only. Holiday-aware deadlines require a verified calendar.
export function israelDate(value=new Date()){const date=new Date(value);return Number.isNaN(+date)?'':date.toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'});}
export function businessDate(start,count){const day=String(start).includes('T')?israelDate(start):start;const date=new Date(day+'T12:00:00');if(Number.isNaN(+date))return '';while(count>0){date.setDate(date.getDate()+1);if(![5,6].includes(date.getDay()))count--;}return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
// Keep the final task key stable for existing records and Google Tasks links.
// Earlier cancellation records remain evidence, never automatic proof of verification.
export function cancellationEvidence(d){return [d.taskEvidence?.cancelCheck,d.tasks?.cancelCheck?.file,d.taskEvidence?.cancel,d.tasks?.cancel?.file].find(file=>file?.data);}
export function cancellationReminder(d,today=israelDate()){
 if(actionKind(d.action)!=='replace'||!d.produced||d.completed||d.stopped||d.tasks?.cancelCheck?.done)return null;
 const planned=businessDate(d.effective,14),urgentDate=d.cancellationUrgentAt?israelDate(d.cancellationUrgentAt):today;
 const due=d.cancellationUrgent&&(!planned||urgentDate<planned)?urgentDate:planned;
 return {key:'cancelCheck',title:'מעקב ואישור ביטול הפוליסה הישנה',due,urgent:!!d.cancellationUrgent||!!due&&due<=today};
}
export function taskList(d){if(d.consolidationId)return [{key:'verify',title:'בדיקת פרטי ההפקה מול הסיכום'}];return [{key:'verify',title:'בדיקת פרטי ההפקה מול הסיכום'},...(actionKind(d.action)==='replace'?[{key:'cancelCheck',title:'מעקב ואישור ביטול הפוליסה הישנה',due:businessDate(d.effective,14)}]:[]),...(actionKind(d.action)==='transfer'?[{key:'deliver',title:'שליחת מסמך הניוד ללקוח'}]:[]),{key:'call',title:actionKind(d.action)==='transfer'?'שיחת טלפון ללקוח על השלמת הניוד':'הודעת עדכון ללקוח על המייל והביצוע'}];}
export function productionCheckCurrent(d){return ['agent','change'].includes(actionKind(d.action))?agentAppointmentReady(d)&&changeWorkflowReady(d):productionVerificationReady(d);}
export function followupTaskDone(d,key){if(key==='verify'&&['agent','change'].includes(actionKind(d.action)))return productionCheckCurrent(d);return !!d.tasks?.[key]?.done&&(d.completed||key!=='verify'||productionCheckCurrent(d));}
export function closeTreatment(client,d){
 d=client.decisions.find(x=>x.id===d.id);
 if(!d)throw Error('המהלך לא נמצא.');
 if(d.completed)return client; // Preserve historical completion without rewriting its evidence.
 if(d.consolidationId)throw Error('סיום איחוד מתועד פעם אחת בכרטיס האיחוד, לאחר קליטת כל המקורות ועדכון הלקוח.');
 if(depositDifference(d).open)throw Error('יש לסיים בירור פער ההפקדה');
 if(!d.produced||d.cancellationUrgent||!productionCheckCurrent(d)||!taskList(d).every(t=>followupTaskDone(d,t.key)))throw Error('יש להשלים את כל משימות ההמשך ואת בדיקת ההפקה התקפה.');
 return {...client,decisions:client.decisions.map(x=>x.id===d.id?{...x,completed:true,completedAt:new Date().toISOString()}:x)};
}
export function completeTask(client,id,key,data){
 const d=client.decisions.find(x=>x.id===id);if(!d?.produced||d.completed)throw Error('המהלך עדיין לא הופק או כבר נסגר.');
 if(!taskList(d).some(t=>t.key===key))throw Error('משימה לא מוכרת');
 if(key==='verify'&&!productionCheckCurrent(d))throw Error('נדרשת בדיקת הנתונים בפועל מול התנאים שסוכמו; סימון סעיפים בלבד אינו מספיק.');
 if(d.tasks?.[key]?.done)return client;
 if(key==='verify')data={...data,verification:d.productionVerification||d.pensionVerification||{appointment:d.agentAppointment,changes:d.changeTasks}};
 if(key==='verify'&&actionKind(d.action)==='replace'&&!d.policyDocument?.data)throw Error('יש לשמור את מסמך הפוליסה החדשה לפני אישור בדיקתה.');
 if(key==='cancelCheck'){
  if(!followupTaskDone(d,'verify')||!signedKit(d))throw Error('יש להשלים את בדיקת ההפקה ואת קיט החתימה לפני אישור הביטול.');
  if(!data.confirmed||!data.reference?.trim())throw Error('יש לאשר שביטול הפוליסה הישנה בוצע ונבדק ולתעד אסמכתה.');
  const date=new Date(data.when+'T12:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data.when||'')||!Number.isFinite(+date)||date.toISOString().slice(0,10)!==data.when)throw Error('יש להזין תאריך בדיקת ביטול תקין.');
  if(data.when>israelDate())throw Error('אי אפשר לאשר שבדיקת ביטול בוצעה בתאריך עתידי.');
  data={...data,file:data.file?.data?data.file:cancellationEvidence(d)};
  if(!data.file?.data)throw Error('יש לשמור אישור ביטול בכתב בתיק; אישור קבלת בקשה אינו אישור ביצוע.');
 }
 if(key==='deliver'&&!data.delivery?.sent&&(!d.documentsVerified||!d.documents?.length||!d.documents.every(x=>x.done)))throw Error('יש לשלוח את מסמכי הביצוע ללקוח או לתעד מסירה ידנית.');
 if(key==='call'&&(!data.contacted||!data.when||!Number.isFinite(+new Date(data.when))||new Date(data.when)>new Date()))throw Error('יש לתעד עדכון שבוצע בפועל; קביעת שיחה לעתיד אינה מסיימת את המשימה.');
 const stamp=new Date().toISOString(),task={...data,done:true,at:stamp};
 return {...client,products:key==='cancelCheck'?client.products.map(p=>p.id===d.productId?{...p,archived:true,pendingCancellation:false,cancellation:task}:p):client.products,appointments:key==='call'?[...client.appointments,{id:crypto.randomUUID(),decisionId:id,title:'שיחת עדכון לאחר ביצוע',type:'עדכון שבוצע',when:data.when,done:true}]:client.appointments,decisions:client.decisions.map(x=>x.id===id?{...x,cancellationUrgent:key==='cancelCheck'?false:x.cancellationUrgent,tasks:{...x.tasks,[key]:task}}:x)};
}
