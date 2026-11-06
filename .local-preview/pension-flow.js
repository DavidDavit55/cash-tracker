import {businessDate,isPensionTransfer,recordExternalKit} from './workflow-process.js';
import {validPastDate} from './production-verification.js';
// Historical evidence is not migrated or inferred from the previous dispatch date.
export const openingRequired=d=>isPensionTransfer(d)&&d.pensionFlow?.version===1&&d.sent&&!d.pensionFlow.openingVerified;
export const openingDue=d=>d.pensionFlow?.openingRetry||businessDate(d.pensionFlow?.signedDate,2);
export function recordPensionSignature(d,data){
 if(!d.signatureSent||!validPastDate(data.date)||data.date<String(d.signatureSentAt||'').slice(0,10))throw Error('יש להזין תאריך חתימה שאינו קודם לשליחה לחתימה.');
 return {...recordExternalKit(d,data),pensionFlow:{...d.pensionFlow,version:1,signedDate:data.date}};
}
export function recordOpening(d,{policy,date,evidence}){
 if(d.pensionFlow?.openingDocument&&!d.pensionFlow.openingDocumentReviewed)throw Error('יש לבדוק את התאמת המסמך ללקוח ולקופת היעד לפני אישור הפתיחה.');
 if(!openingRequired(d)||!String(policy||'').trim()||!validPastDate(date)||date<d.pensionFlow.signedDate||!String(evidence||'').trim())throw Error('יש להזין מספר חשבון, מקור אימות ותאריך בדיקה שאינו קודם לחתימה.');
 return {policy:String(policy).trim(),pensionFlow:{...d.pensionFlow,openingVerified:true,openingDate:date,openingEvidence:evidence.trim(),openingRetry:null}};
}
