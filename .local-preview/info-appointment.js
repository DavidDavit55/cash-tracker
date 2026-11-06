import {businessDate,signedKit} from './workflow-process.js';
import {validPastDate,present} from './production-verification.js';
export function informationAppointmentTask(d){
 if(!/שחלוף/.test(d.action||'')||!d.signed||d.infoAppointment?.accessVerified||d.stopped)return null;
 const a=d.infoAppointment||{};
 return {key:'info-appointment',title:!a.sentDate?'תיעוד שליחת מינוי מידע לחברה הישנה':a.inquiryRequired?'בירור גישה למידע בחברה הישנה':'בדיקת קליטת מינוי מידע וגישה לפוליסה',due:a.nextCheck||(a.sentDate?businessDate(a.sentDate,10):''),urgent:!!a.inquiryRequired};
}
export function recordInformationSubmission(d,data){
 if(!/שחלוף/.test(d.action||'')||!signedKit(d)||d.infoAppointment?.sentDate)throw Error('נדרש קיט חתום ומינוי שטרם תועדה שליחתו.');
 if(!validPastDate(data.date)||data.date<(d.sentAt||d.signatureSentAt||'').slice(0,10)||!present(data.reference)||!data.document?.data)throw Error('נדרשים תאריך שליחה בפועל, אסמכתה ומינוי חתום שמור.');
 return {infoAppointment:{...d.infoAppointment,sentDate:data.date,submissionReference:data.reference,document:data.document,manual:true,accessVerified:false}};
}
export function recordInformationCheck(d,data){
 const a=d.infoAppointment;if(!a?.sentDate||a.accessVerified)throw Error('יש לתעד תחילה שליחה נפרדת בפועל.');
 if(!validPastDate(data.date)||data.date<a.sentDate||!present(data.reference))throw Error('נדרשים תאריך בדיקת אתר ואסמכתה תקינים.');
 return {infoAppointment:{...a,checks:[...(a.checks||[]),{...data,recordedAt:new Date().toISOString()}],accessVerified:data.access===true,verifiedAt:data.access?data.date:null,inquiryRequired:!data.access,nextCheck:data.access?null:businessDate(data.date,2)}};
}
