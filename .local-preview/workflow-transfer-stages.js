import {businessDate} from './workflow-process.js';
import {depositDifference} from './workflow-detail-rules.js';
import {validPastDate} from './production-verification.js';
import {openingRequired,openingDue} from './pension-flow.js';
export const firstDepositReceived=f=>!!f.payrollSent&&validPastDate(f.depositDate)&&Number.isFinite(Number(f.depositActual))&&Number(f.depositActual)>0;
export function payrollCheckDate(sent){
 const match=String(sent||'').match(/^(\d{4})-(\d{2})-\d{2}/);
 if(!match)return '';
 const year=Number(match[1]),month=Number(match[2]);
 if(month<1||month>12)return '';
 return month===12?`${year+1}-01-20`:`${year}-${String(month+1).padStart(2,'0')}-20`;
}
export function transferStage(d){
 const f=d.transfer||{};
 if(openingRequired(d))return 'opening';
 if(depositDifference(d).open)return 'deposit';
 if(f.verified&&d.fundsConfirmed)return 'done';
 if(f.inactive===undefined)return 'mode';
 if(!f.inactive&&!f.payrollSent)return 'payroll';
 if(!f.inactive&&!firstDepositReceived(f))return 'deposit';
 return 'transfer';
}
export function transferNext(d){
 const f=d.transfer||{},stage=transferStage(d);
 return {stage,title:{opening:'וידוא פתיחת הקופה וקבלת המסמכים בחברה',mode:'בחירת מסלול מעקב — קרן פעילה או לא פעילה',payroll:'שליחת נספח ו׳ וטופס קוביות לחשבת השכר',deposit:'בדיקת הפקדה ראשונה באתר החברה',transfer:'בדיקת קבלת כספי הניוד באתר החברה',done:'כספי הניוד אומתו'}[stage],
 due:stage==='opening'?openingDue(d):stage==='deposit'?(f.depositRetry||payrollCheckDate(f.payrollSentAt)):stage==='transfer'?(f.deskDue||businessDate(f.inactive?d.sentAt:f.depositDate,10)):''};
}
