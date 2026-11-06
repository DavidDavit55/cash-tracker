// Incoming evidence and operational completion are deliberately separate states.
export const reportLabels={received:'הבקשה התקבלה בחברה',missing:'החברה ביקשה השלמה',completed:'החברה דיווחה על השלמת ביצוע'};
export function readMailHeaders(text){
 const head=text.split(/\r?\n\r?\n/,1)[0].replace(/\r?\n[ \t]+/g,' '),headers={};
 for(const line of head.split(/\r?\n/)){const m=line.match(/^([\w-]+):\s*(.*)$/);if(m&&!headers[m[1].toLowerCase()])headers[m[1].toLowerCase()]=m[2];}
 const decode=s=>(s||'').replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi,(_,charset,enc,data)=>{try{const bytes=enc.toLowerCase()==='b'?Uint8Array.from(atob(data),c=>c.charCodeAt(0)):Uint8Array.from(data.replace(/_/g,' ').replace(/=([0-9a-f]{2})/gi,(_,h)=>String.fromCharCode(parseInt(h,16))),c=>c.charCodeAt(0));return new TextDecoder(charset).decode(bytes);}catch{return '[כותרת דורשת בדיקה]';}});
 return {subject:decode(headers.subject),from:decode(headers.from),messageId:headers['message-id']||'',date:headers.date||''};
}
export function linkInboundMail(client,record){
 if(!client.decisions.some(d=>d.id===record.decisionId))throw Error('יש לבחור מהלך קיים בתיק.');
 if(!record.identityConfirmed||!record.subject?.trim()||!record.eml?.id)throw Error('נדרשים מייל מקורי ואימות התאמה ללקוח.');
 if((client.inboundMail||[]).some(m=>m.eml.sha256===record.eml.sha256||record.messageId&&m.messageId===record.messageId))throw Error('המייל הזה כבר משויך לתיק; לא נוצר עותק נוסף.');
 return {...client,inboundMail:[...(client.inboundMail||[]),{...record,linkedAt:new Date().toISOString()}]};
}
export function recordInboundStatus(client,mailId){
 const mail=client.inboundMail?.find(m=>m.id===mailId),d=client.decisions.find(d=>d.id===mail?.decisionId);
 if(!mail||!d||!reportLabels[mail.report?.kind])throw Error('אין עדכון חברה תקין להחלה.');
 if(mail.appliedAt)return client;
 if(d.completed||d.stopped||d.produced)throw Error('המהלך סגור או נקלט; המייל נשמר בלבד ולא משנה את הסטטוס.');
 if(d.companyReport?.reportedAt>=mail.report.reportedAt)throw Error('כבר תועד דיווח באותו מועד או חדש יותר; יש לבדוק ידנית לפני שינוי.');
 if(!Number.isFinite(Date.parse(mail.report.reportedAt))||Date.parse(mail.report.reportedAt)>Date.now())throw Error('יש להזין מועד דיווח תקין שאינו עתידי.');
 const p=client.products.find(p=>p.id===d.productId);
 if(mail.report.kind==='completed'){
  if(!mail.pdf?.id)throw Error('יש לשמור אישור חברה כ־PDF לפני עדכון דיווח השלמה.');
  if(/^ניוד/.test(d.action)&&(!mail.report.sourcePolicy||mail.report.sourcePolicy!==p?.policy))throw Error('חשבון המקור באישור אינו תואם למוצר שנבחר.');
  if(!mail.report.effective||!Number.isFinite(Date.parse(mail.report.effective))||Date.parse(mail.report.effective)>Date.now())throw Error('נדרש תאריך ביצוע תקין שאינו עתידי.');
  if(/^ניוד/.test(d.action)&&(!mail.report.targetPolicy||mail.report.amount===''||!Number.isFinite(Number(mail.report.amount))||Number(mail.report.amount)<0))throw Error('נדרשים חשבון יעד וסכום שהתקבל.');
 }
 const at=new Date().toISOString();
 return {...client,inboundMail:client.inboundMail.map(m=>m.id===mail.id?{...m,appliedAt:at}:m),decisions:client.decisions.map(x=>x.id===d.id?{...x,companyReport:{...mail.report,mailId:mail.id,recordedAt:at,verificationPending:true}}:x)};
}
