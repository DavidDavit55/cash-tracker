import {businessDate,israelDate} from './workflow-process.js';
import {present,validPastDate} from './production-verification.js';
import {hasFeeChange,feeAgreementPending} from './fee-change-agreement.js';
const agentKind=d=>/^מינוי סוכן/.test(d.action||'');
export function addCalendarMonths(start,count){
 if(!validPastDate(start,'9999-12-31'))return '';
 const date=new Date(start+'T12:00:00Z'),day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+count);
 const end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,end));return date.toISOString().slice(0,10);
}
export function appointmentSubmission(d){return d.agentAppointment?.submission?.date||d.sentAt?.slice(0,10)||'';}
export function agentAppointmentReady(d){
 if(!agentKind(d))return true;
 const a=d.agentAppointment||{},submitted=appointmentSubmission(d);
 return !!a.verifiedAt&&validPastDate(a.verifiedAt.slice(0,10))&&validPastDate(a.acceptedAt)&&validPastDate(submitted)&&a.acceptedAt>=submitted&&a.acceptedAt<=a.verifiedAt.slice(0,10)&&a.siteChecked===true&&present(a.siteReference);
}
export function recordAppointmentCheck(d,data){
 if(!agentKind(d)||!d.sent||d.completed||!validPastDate(appointmentSubmission(d)))throw Error('יש לתעד תחילה חתימה ושליחה בפועל של המינוי.');
 if(!validPastDate(data.date)||data.date<appointmentSubmission(d))throw Error('יש להזין תאריך בדיקה תקין.');
 if(data.result&&!['accepted','pending'].includes(data.result))throw Error('יש לבחור תוצאת בדיקה.');
 data={...data,reference:data.reference?.trim()||'',siteChecked:data.result?data.result==='accepted':data.siteChecked};
 const a=d.agentAppointment||{},history=[...(a.checks||[]),{...data,recordedAt:new Date().toISOString()}];
 if(!data.siteChecked)return {agentAppointment:{...a,checks:history,nextCheck:businessDate(data.date,2),lastCheckedAt:data.date,inquiryRequired:true,verifiedAt:null},approved:false};
 data={...data,acceptedAt:data.acceptedAt||data.date,reference:data.reference||'המוצר מופיע תחתיי באתר החברה'};
 if(!validPastDate(data.acceptedAt)||data.acceptedAt<appointmentSubmission(d)||data.acceptedAt>data.date)throw Error('יש להזין תאריך תקין.');
 return {agentAppointment:{...a,checks:history,acceptedAt:data.acceptedAt,verifiedAt:data.date+'T12:00:00Z',siteChecked:true,siteReference:data.reference,inquiryRequired:false,nextCheck:null},approved:true,effective:data.acceptedAt,evidence:data.reference,approvedAt:new Date().toISOString()};
}
export function changeRequestSpecs(d){
 if(d.action!=='מינוי סוכן וביצוע השינויים שבסיכום')return [];
 const accepted=d.agentAppointment?.acceptedAt||'',fees=hasFeeChange(d);
 return [...(d.allocations?.length||present(d.track)?[{key:'track',title:'בדיקת ביצוע שינוי מסלולי השקעה',submissionMode:'with_appointment',available:appointmentSubmission(d)}]:[]),
 ...(fees?[{key:'fees',title:'בקשת הנחה ואימות התנאים',available:addCalendarMonths(accepted,3)}]:[]),
 ...(present(d.changeDetails)?[{key:'other',title:'ביצוע השינויים הנוספים שסוכמו',available:accepted}]:[])];
}
export function changeRequests(d){
 return changeRequestSpecs(d).map(t=>{const r=d.changeTasks?.[t.key]||{},submitted=r.submittedAt|| (t.submissionMode==='with_appointment'&&d.sent?appointmentSubmission(d):'');
  return {...t,submittedAt:submitted,due:r.nextCheck|| (submitted?businessDate(submitted,10):t.available),waiting:!submitted&&!t.available,clientDecisionRequired:!!r.clientDecisionRequired};});
}
export function changeFields(d,key){
 if(key==='fees')return [['depositFee','דמי ניהול מהפקדה (%)',d.depositFee],['balanceFee','דמי ניהול מצבירה (%)',d.balanceFee],['premium','פרמיה חודשית (₪)',d.targetPremium]].filter(([, ,v])=>present(v)).map(([key,label,expected])=>({key,label,expected,numeric:true,max:key==='premium'?undefined:100}));
 if(key==='track')return d.allocations?.length?d.allocations.map((r,i)=>({key:'percent'+i,label:'אחוז השקעה בפועל — '+r.name,expected:r.percent,numeric:true,max:100})):[{key:'track',label:'מסלול השקעה',expected:d.track}];
 return [{key:'details',label:'השינוי שבוצע באתר',expected:d.changeDetails}];
}
export function changeFieldMatches(f,v){return present(v)&&present(f.expected)&&(f.numeric?Number.isFinite(Number(v))&&Number(v)>=0&&(f.max==null||Number(v)<=f.max)&&Number(v)===Number(f.expected):String(v).trim().replace(/\s+/g,' ')===String(f.expected).trim().replace(/\s+/g,' '));}
function changeValuesMatch(d,key,actual){
 const fields=changeFields(d,key);
 return fields.every(f=>changeFieldMatches(f,actual?.[f.key]))&&(key!=='track'||!d.allocations?.length||Math.abs(fields.reduce((sum,f)=>sum+Number(actual?.[f.key]),0)-100)<0.000001);
}
export function changeTaskReady(d,key){
 const r=d.changeTasks?.[key],t=changeRequests(d).find(t=>t.key===key);
 return !!r?.done&&!!t&&!!t.submittedAt&&validPastDate(t.submittedAt)&&r.siteChecked===true&&validPastDate(r.checkedDate)&&r.checkedDate>=t.submittedAt&&present(r.reference)&&!r.clientDecisionRequired&&changeValuesMatch(d,key,r.actual);
}
export function changeWorkflowReady(d){return d.action!=='מינוי סוכן וביצוע השינויים שבסיכום'||agentAppointmentReady(d)&&!feeAgreementPending(d)&&changeRequests(d).length>0&&changeRequests(d).every(t=>changeTaskReady(d,t.key));}
export function recordChangeSubmission(d,key,data){
 const t=changeRequests(d).find(t=>t.key===key);if(!t||t.submittedAt||d.completed||!agentAppointmentReady(d))throw Error('הבקשה אינה זמינה להגשה או כבר הוגשה.');
 if(!t.available||!validPastDate(data.date)||data.date<t.available||!present(data.reference))throw Error('יש לתעד הגשה בפועל ב־SMS 2010 לאחר מועד הזכאות, עם תאריך ואסמכתה.');
 return {changeTasks:{...d.changeTasks,[key]:{...d.changeTasks?.[key],submittedAt:data.date,submissionReference:data.reference,channel:'SMS 2010',done:false}}};
}
export function recordChangeCheck(d,key,data){
 const t=changeRequests(d).find(t=>t.key===key);if(!t?.submittedAt||d.completed||!validPastDate(t.submittedAt)||!agentAppointmentReady(d))throw Error('יש לאמת תחילה את קליטת המינוי ולתעד את הגשת הבקשה.');
 if(!validPastDate(data.date)||data.date<t.submittedAt||!present(data.reference))throw Error('יש להזין תאריך בדיקת אתר תקין ואסמכתה.');
 const old=d.changeTasks?.[key]||{},record={...old,submittedAt:t.submittedAt,checks:[...(old.checks||[]),{...data,recordedAt:new Date().toISOString()}],reference:data.reference,checkedDate:data.date,actual:{...data.actual}};
 if(data.result==='complete'){
  if(!data.siteChecked||!changeValuesMatch(d,key,data.actual))throw Error('הנתונים באתר חייבים להתאים לשינוי שסוכם. בפיזור מסלולים נדרשת חלוקה מלאה של 100%. קבלת בקשה אינה ביצוע.');
  return {changeTasks:{...d.changeTasks,[key]:{...record,done:true,at:new Date().toISOString(),siteChecked:true,nextCheck:null,inquiryRequired:false,clientDecisionRequired:false}}};
 }
 if(!['pending','rejected','partial','alternative'].includes(data.result))throw Error('יש לבחור את תוצאת הבדיקה.');
 const clientDecisionRequired=key==='fees'&&['rejected','partial'].includes(data.result)||data.result==='alternative';
 return {changeTasks:{...d.changeTasks,[key]:{...record,done:false,siteChecked:false,result:data.result,nextCheck:clientDecisionRequired?data.date:businessDate(data.date,2),inquiryRequired:!clientDecisionRequired,clientDecisionRequired}}};
}
export function appointmentTask(d){
 if(!agentKind(d)||d.completed||agentAppointmentReady(d)||!d.sent)return null;
 const a=d.agentAppointment||{};return {due:a.nextCheck||businessDate(appointmentSubmission(d),10),urgent:!!a.inquiryRequired,title:a.inquiryRequired?'בירור קליטת מינוי הסוכן באתר החברה':'בדיקת קליטת מינוי הסוכן באתר החברה'};
}
