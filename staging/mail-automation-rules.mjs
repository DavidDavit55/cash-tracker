import {createHash} from 'node:crypto';
import {nationalIds} from '../backend/src/services/gmail.js';
import {openingRequired,recordOpening} from '../.local-preview/pension-flow.js';
import {openingCandidates} from '../.local-preview/opening-mail.js';
import {payrollReplyPending,recordPayrollReply} from '../.local-preview/payroll-reply.js';
const providers={'הפניקס':['fnx.co.il'],'הראל':['harel-ins.co.il','harel-group.co.il'],'מנורה':['menoramivt.co.il'],'מגדל':['migdal.co.il'],'מיטב':['meitav.co.il']};
export const automationVersion=2;
export const mailKey=m=>createHash('sha256').update(m.metadata?.rfcMessageId||m.raw||m.id).digest('hex');
export function planMail(state,m,extracted){
 const base={key:mailKey(m),mailId:m.id,subject:m.metadata?.subject||'',version:automationVersion,clientId:m.client_id||null};
 const out=(status,reason,extra={})=>({...base,status,reason,...extra});
 const subject=m.metadata?.subject||'';
 if(m.metadata?.direction!=='incoming')return out('ignored','מייל יוצא — אינו אישור ביצוע');
 if(m.metadata?.bulk||m.metadata?.promotional||/מייל יומי|דוח יומי|daily report|automatic reply/i.test(subject))return out('ignored','דיוור או מענה אוטומטי');
 if(extracted.error)return out('exception',extracted.error);
 if((m.pdfs||[]).some(p=>Buffer.from(p.data||'','base64').length>8000000))return out('exception','מסמך מעל 8MB — נדרשת בדיקה');
 const labelled=[...String(subject+' '+extracted.text).matchAll(/(?:ת[.״"׳']?\s*ז[.״"׳']?|מספר\s*זהות)\s*[:־-]?\s*(\d{9})(?!\d)/g)].map(m=>m[1]);
 const ids=[...new Set(labelled.length?labelled.filter(id=>nationalIds(id).length):nationalIds(subject+' '+extracted.text))];
 const candidates=state.clients.filter(c=>ids.includes(c.identity));
 if(!candidates.length&&m.client_id&&!state.clients.some(c=>c.id===m.client_id))return out('ignored','המייל שייך לתיק שאינו ברשימת הלקוחות הנוכחית');
 if(ids.length&&!candidates.length)return out('ignored','הזהות במייל אינה שייכת ללקוח נוכחי');
 if(ids.length!==1||candidates.length!==1)return out('exception','אין זיהוי לקוח יחיד וחד־משמעי בתוכן');
 const client=candidates[0];base.clientId=client.id;base.clientName=client.name;
 if(m.client_id&&m.client_id!==client.id)return out('exception','סתירה בין השיוך הקיים לזהות במסמך');
 const date=String(m.metadata.at||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Date.parse(date)>Date.now())return out('exception','תאריך מייל לא תקין');
 const active=(client.decisions||[]).filter(d=>!d.completed&&!d.stopped);
 if(!active.length)return out('ignored','אין מהלך פתוח ללקוח');
 const payroll=active.filter(d=>payrollReplyPending(d)&&d.transfer.payrollEmail?.toLowerCase()===extracted.senderAddress&&date>=d.transfer.payrollSentAt&&extracted.authenticatedDomains.includes(extracted.senderDomain));
 const reply=String(extracted.body||'').split(/\n\s*(?:From:|מאת:|On .*wrote:|בתאריך)/)[0].trim();
 const months=[...reply.matchAll(/(?:חודש\s*(?:שכר)?|משכר)\s*[:־-]?\s*(\d{2})[/.](\d{4})/g)].map(m=>m[2]+'-'+m[1]);
 if(payroll.length===1&&/עודכנ[וה]|בוצע העדכון/.test(reply)&&!/לא |טרם|חסר|אין /.test(reply)&&new Set(months).size===1)return out('payroll','אושר עדכון אצל חשבת השכר — ללא אישור הפקדה',{decisionId:payroll[0].id,date,salaryMonth:months[0]});
 const annexes=extracted.documents.filter(p=>nationalIds(p.text).includes(client.identity)&&/הודעה על בחירת עובד בקרן פנסיה|הודעה למעסיק על בחירת עובד/.test(p.text));
 const annexTargets=active.filter(d=>d.pensionFlow?.openingVerified&&date>=d.pensionFlow.signedDate&&providers[d.target]?.includes(extracted.senderDomain)&&extracted.authenticatedDomains.includes(extracted.senderDomain)&&(!d.transfer?.annex||d.transfer.annex.simulated));
 if(annexTargets.length===1&&annexes.length===1&&annexes[0].text.includes(annexTargets[0].target))return out('attach','נספח ו׳ אמיתי זוהה במקום מסמך חסר או מסמך דמה',{decisionId:annexTargets[0].id,pdfIndex:annexes[0].index,annex:true});
 const opening=active.filter(d=>openingRequired(d)&&date>=d.pensionFlow.signedDate&&providers[d.target]?.includes(extracted.senderDomain)&&extracted.authenticatedDomains.includes(extracted.senderDomain));
 const evidence=extracted.documents.filter(p=>nationalIds(p.text).includes(client.identity)&&/אישור\s*(?:פתיחת|הצטרפות)|הודעה למעסיק על בחירת עובד/.test(p.text)&&!/טרם נפתח|לא נפתח|בקשת הצטרפות|חוסרים|נדחתה/.test(p.text));
 if(opening.length===1&&evidence.length===1){
  const d=opening[0],document=evidence[0],policy=openingCandidates(document.text).policy;
  if(!document.text.includes(d.target))return out('exception','המסמך אינו מזהה את חברת היעד');
  if(!policy)return out('exception','אישור מועמד ללא מספר חשבון יעד יחיד',{decisionId:d.id});
  // Never derive the destination account from a national ID or from a source account.
  if(policy===client.identity||(client.products||[]).some(p=>p.policy===policy))return out('exception','מספר החשבון המוצע הוא מזהה לקוח או חשבון מקור',{decisionId:d.id});
  return out('advance','אישור פתיחה מזוהה',{decisionId:d.id,policy,date,pdfIndex:document.index,annex:/נספח\s*ו[׳'״"]|הודעה למעסיק על בחירת עובד/.test(document.text)});
 }
 if(opening.length>1)return out('exception','כמה מהלכים לאותו יעד — נדרש לזהות את המוצר והמהלך המדויק');
 return out('exception','המייל נשמר; אין אסמכתה חד־משמעית לקידום אוטומטי בשלב הנוכחי');
}
export function applyOpeningPlan(state,plan,file){
 if(!['advance','attach','payroll'].includes(plan.status))return state;
 const next=structuredClone(state),client=next.clients.find(c=>c.id===plan.clientId),d=client?.decisions.find(d=>d.id===plan.decisionId);
 if(!d||plan.status!=='payroll'&&!file?.id)throw Error('stale_plan');
 if(plan.status==='payroll'){Object.assign(d,recordPayrollReply(d,{status:'confirmed',date:plan.date,salaryMonth:plan.salaryMonth,evidence:'אישור עדכון במייל '+plan.mailId}));d.mailAutomationHistory=[...(d.mailAutomationHistory||[]),{...plan,appliedAt:new Date().toISOString()}];return next;}
 const pensionFlow={...d.pensionFlow,openingDocument:{...file,privateFile:true,mailId:plan.mailId,attachmentIndex:plan.pdfIndex},openingDocumentReviewed:true};
 if(plan.status==='advance')Object.assign(d,recordOpening({...d,pensionFlow},{policy:plan.policy,date:plan.date,evidence:'אישור חברה במייל '+plan.mailId}));
 if(plan.annex&&(!d.transfer?.annex||d.transfer.annex.simulated))d.transfer={...d.transfer,previousAnnex:d.transfer?.annex||null,annex:pensionFlow.openingDocument};
 d.mailAutomationHistory=[...(d.mailAutomationHistory||[]),{...plan,appliedAt:new Date().toISOString()}];
 return next;
}
