import {businessDate} from './workflow-process.js';
import {validPastDate} from './production-verification.js';
import {firstDepositReceived} from './workflow-transfer-stages.js';
export function payrollReplyPending(d){const f=d.transfer||{};return !!(d.sent&&!d.completed&&!d.stopped&&!d.produced&&!d.fundsConfirmed&&f.inactive===false&&f.payrollSent&&!firstDepositReceived(f)&&f.payrollReply?.status!=='confirmed');}
export const payrollReplyDue=d=>d.transfer?.payrollReply?.nextCheck||businessDate(d.transfer?.payrollSentAt,2);
export function recordPayrollReply(d,{status,date,evidence,salaryMonth}){
 if(!payrollReplyPending(d)||!['received','missing','confirmed','no-reply'].includes(status)||!validPastDate(date)||date<String(d.transfer.payrollSentAt||'').slice(0,10))throw Error('יש להזין תאריך בדיקה תקין לאחר שליחת המייל.');
 if(!String(evidence||'').trim())throw Error('יש לתעד את התשובה או את תוצאת המעקב.');
 if(status==='confirmed'&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(salaryMonth||''))throw Error('יש לציין מאיזה חודש שכר אושר העדכון.');
 const entry={status,date,evidence:evidence.trim(),...(status==='confirmed'?{salaryMonth}:{}),recordedAt:new Date().toISOString()};
 return {transfer:{...d.transfer,payrollReply:{...entry,nextCheck:status==='confirmed'?null:businessDate(date,2),history:[...(d.transfer.payrollReply?.history||[]),entry]}}};
}
