// Existing terms are not consent to request a discount. Retain documented work.
export const hasFeeValues=d=>[d.depositFee,d.balanceFee,d.targetPremium].some(v=>v!=null&&v!=='');
export const hasFeeChange=d=>d.feeChangeRequested===true||!!d.changeTasks?.fees?.submittedAt||!!d.changeTasks?.fees?.done;
export const feeAgreementPending=d=>d.action==='מינוי סוכן וביצוע השינויים שבסיכום'&&hasFeeValues(d)&&typeof d.feeChangeRequested!=='boolean'&&!hasFeeChange(d);
export function recordFeeChangeAgreement(d,requested){
 if(d.action!=='מינוי סוכן וביצוע השינויים שבסיכום'||d.completed||d.produced||typeof requested!=='boolean'||(!requested&&(d.changeTasks?.fees?.submittedAt||d.changeTasks?.fees?.done)))throw Error('לא ניתן לבטל בקשה שכבר תועדה כהוגשה. יש לשמור את היסטוריית הטיפול.');
 if(requested&&!hasFeeValues(d))throw Error('יש להשלים את התנאים שסוכמו לפני פתיחת בקשת הנחה.');
 return {feeChangeRequested:requested,feeChangeAgreementAt:new Date().toISOString()};
}
