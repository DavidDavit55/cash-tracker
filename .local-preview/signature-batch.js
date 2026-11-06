import {currentDecisions,noAction} from './workflow-model.js';
import {recordSignatureDispatch} from './workflow-process.js';
import {recordExternalKit,isPensionTransfer} from './workflow-process.js';
import {recordPensionSignature} from './pension-flow.js';
export function applySharedSignature(c,id,patch,selectedIds){
 const anchor=c.decisions.find(d=>d.id===id);
 if(!anchor||!patch.signed||!patch.sent||!patch.sms2010?.manual)throw Error('נדרש תיעוד חתימה בפועל.');
 const ids=selectedIds||c.decisions.filter(d=>d.id===id||anchor.signatureBatchId&&d.signatureBatchId===anchor.signatureBatchId||anchor.consolidationId&&d.consolidationId===anchor.consolidationId).map(d=>d.id);
 const active=new Set(currentDecisions(c).filter(d=>!noAction(d)&&!d.stopped&&!d.completed&&!d.produced).map(d=>d.id));
 if(selectedIds?.some(key=>!active.has(key)))throw Error('המוצרים שנבחרו אינם זמינים לחתימה.');
 const decisions=c.decisions.map(d=>{
  if(!ids.includes(d.id)||!active.has(d.id)||d.signed||d.sent)return d;
  if(!d.signatureSent)throw Error('יש לתעד תחילה את שליחת המסמכים לחתימה.');
  const data={date:patch.sms2010.sentDate,identityAttached:patch.sms2010.identityAttached};
  return {...d,...(isPensionTransfer(d)?recordPensionSignature:recordExternalKit)(d,data),signatureSourceId:id};
 });
 return {...c,decisions};
}
export const dispatchCandidates=c=>currentDecisions(c).filter(d=>!noAction(d)&&!d.signatureSent&&!d.sent&&!d.signed&&!d.completed&&!d.produced);
export function dispatchBatch(c,ids,date,batchId){
 if(!c.summarySent||!batchId||!ids.length||new Set(ids).size!==ids.length)throw Error('יש לשלוח סיכום ולבחור את המוצרים שנשלחו יחד.');
 const eligible=dispatchCandidates(c);
 if(ids.some(id=>!eligible.some(d=>d.id===id)))throw Error('רשימת המוצרים השתנתה. יש לבדוק שוב את הבחירה.');
 const patches=new Map(ids.map(id=>[id,{...recordSignatureDispatch(eligible.find(d=>d.id===id),date),signatureBatchId:batchId}]));
 return {...c,decisions:c.decisions.map(d=>patches.has(d.id)?{...d,...patches.get(d.id)}:d)};
}
export function messageBatchIds(c,anchor){
 if(!anchor)return [];
 return c.decisions.filter(d=>!noAction(d)&&!d.completed&&d.signatureSent&&(anchor.signatureBatchId?d.signatureBatchId===anchor.signatureBatchId:d.id===anchor.id)).map(d=>d.id);
}
export function recordSignatureMessageSent(c,id,at=new Date().toISOString()){
 const anchor=c.decisions.find(d=>d.id===id);
 if(!anchor?.signatureSent||!anchor.messagePrepared||!anchor.messageText?.trim())throw Error('יש להכין נוסח ולשלוח את ההודעה לפני תיעוד השליחה.');
 const ids=messageBatchIds(c,anchor);
 return {...c,decisions:c.decisions.map(d=>ids.includes(d.id)&&!d.signatureMessageSentAt?{...d,signatureMessageSentAt:at}:d)};
}
export function reuseSignatureMessage(c,targetId,sourceId){
 const source=c.decisions.find(d=>d.id===sourceId),target=c.decisions.find(d=>d.id===targetId);
 if(!source?.signatureMessageSentAt||!source.messageText?.trim()||!target?.signatureSent||target.signatureMessageSentAt||target.completed||target.stopped)throw Error('לא ניתן לקשר את תיעוד ההודעה שנבחר.');
 const ids=messageBatchIds(c,target);
 return {...c,decisions:c.decisions.map(d=>ids.includes(d.id)&&!d.signatureMessageSentAt?{...d,messagePrepared:true,messageText:source.messageText,signatureMessageSentAt:source.signatureMessageSentAt,signatureMessageSourceId:source.id}:d)};
}
