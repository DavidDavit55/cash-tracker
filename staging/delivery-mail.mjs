import {attachmentMessage} from './payroll-mail.mjs';
import {actionKind} from '../.local-preview/workflow-process.js';
export function deliveryMessage(client,body){
 const d=client.decisions?.find(x=>x.id===body.decisionId);
 if(!d?.produced||d.completed||!d.tasks?.verify?.done||actionKind(d.action)!=='transfer'||!d.fundsConfirmed)throw Error('invalid_delivery');
 const file=d.transfer?.document,match=file?.data?.match(/^data:([^,]*),(.*)$/s);
 if(!match||file.data.length>1100000)throw Error('missing_transfer_document');
 const type=match[1].split(';')[0];if(!['application/pdf','image/png','image/jpeg','text/plain'].includes(type))throw Error('invalid_attachment');
 const bytes=match[1].includes(';base64')?Buffer.from(match[2],'base64'):Buffer.from(decodeURIComponent(match[2]));
 if(!bytes.length||bytes.length>700000)throw Error('invalid_attachment');
 const name=String(file.name||'transfer').replace(/[\r\n\x00-\x1f]/g,'').slice(0,160);
 const subject=`אישור השלמת ניוד — ${client.name} [בדיקת סטייגינג]`;
 const text=`סביבת בדיקה — נשלח לכתובת הבדיקה בלבד.\n\nשלום ${client.name},\nמצורף מסמך הניוד שנבדק במסגרת ${d.action}.\n${file.simulated?'מצורף מסמך דמה, לא אישור ביצוע אמיתי.\n':''}\nדוד · NETWORTH`;
 return attachmentMessage({clientId:client.id,decisionId:d.id,kind:'delivery',subject,text,intended:client.email||'',attachments:[{name,type,bytes}]});
}
