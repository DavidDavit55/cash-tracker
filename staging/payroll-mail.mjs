import {payrollText} from '../.local-preview/payroll-text.js';
import {openingRequired} from '../.local-preview/pension-flow.js';
import {digest} from '../backend/src/services/gmail.js';
import {SENDER,RECIPIENT} from './mail.mjs';
import {actionKind,israelDate} from '../.local-preview/workflow-process.js';
const b64=value=>Buffer.from(value).toString('base64').match(/.{1,76}/g)?.join('\r\n')||'';
export function payrollMessage(client,body){
 const d=client.decisions?.find(x=>x.id===body.decisionId),f=body.draft;
 if(d&&openingRequired(d))throw Error('יש לאמת את פתיחת הקופה לפני שליחה לחשבת השכר.');
 if(!d||actionKind(d.action)!=='transfer'||!d.sent||d.completed||d.stopped||d.missing||d.underwritingPending||d.transfer?.inactive!==false||!f||!/^\S+@[^\s@]+\.[^\s@]+$/.test(f.payrollEmail||'')||/[\r\n]/.test(f.payrollEmail)||!/^\d{4}-\d{2}$/.test(f.salaryMonth||''))throw Error('invalid_payroll');
 const attachments=[['annex','annex'],['cubes','cubes']].map(([key,fallback])=>{
  const file=f[key],limit=file?.serverArchived?8000000:700000,match=file?.data?.match(/^data:([^,]*),(.*)$/s);if(!match||file.data.length>Math.ceil(limit*1.4)+100)throw Error('invalid_attachment');
  const type=match[1].split(';')[0];if(!['application/pdf','image/png','image/jpeg','text/plain'].includes(type))throw Error('invalid_attachment');
  const bytes=match[1].includes(';base64')?Buffer.from(match[2],'base64'):Buffer.from(decodeURIComponent(match[2]));if(!bytes.length||bytes.length>limit)throw Error('invalid_attachment');
  const name=String(file.name||fallback).replace(/[\r\n\x00-\x1f]/g,'').slice(0,160);
  return {name,type,bytes,simulated:!!file.simulated};
 });
 const product=client.products?.find(p=>p.id===d.productId),category=product?.category||'פנסיה',subject=`עדכון הפקדות ${category} ${client.name} [בדיקת סטייגינג]`;
 const text=`סביבת בדיקה — נמען מיועד: ${f.payrollEmail}. נשלח בפועל רק לכתובת הבדיקה.\n\n${payrollText(client,f)}${attachments.some(a=>a.simulated)?'\n\nשים לב: מצורפים מסמכי דמה, לא לביצוע.':''}`;
 return attachmentMessage({clientId:client.id,decisionId:d.id,text,attachments,subject,intended:f.payrollEmail,kind:'payroll'});
}
export function attachmentMessage({clientId,decisionId,text,attachments,subject,intended,kind}){
 const key=digest(JSON.stringify([kind,clientId,decisionId,text,attachments.map(a=>[a.name,a.type,digest(a.bytes)])])),boundary='networth-'+key;
 const parts=[`From: ${SENDER}`,`To: ${RECIPIENT}`,'Subject: =?UTF-8?B?'+Buffer.from(subject).toString('base64')+'?=',`Message-ID: <${key}@davit-fin.co.il>`,'MIME-Version: 1.0',`Content-Type: multipart/mixed; boundary="${boundary}"`,'',`--${boundary}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',b64(text)];
 for(const a of attachments)parts.push(`--${boundary}`,`Content-Type: ${a.type}`,`Content-Disposition: attachment; filename="${a.type==='application/pdf'?'document.pdf':a.type==='text/plain'?'document.txt':'image'}"; filename*=UTF-8''${encodeURIComponent(a.name)}`,'Content-Transfer-Encoding: base64','',b64(a.bytes));
 parts.push(`--${boundary}--`,'');
 return {raw:Buffer.from(parts.join('\r\n')).toString('base64url'),key,subject,intended,payrollSentAt:israelDate()};
}
