export function applyCompanyMail(client, message) {
 const index=client.messages.findIndex(m=>m.id===message.id);
 const mail=client.messages[index],d=client.decisions.find(d=>d.id===mail?.decisionId);
 if(!d||!mail||mail.applied||!d.sent||d.stopped||d.produced||d.completed)throw Error('המייל אינו ניתן להחלה על המהלך במצבו הנוכחי.');
 if(client.messages.slice(index+1).some(m=>m.decisionId===d.id&&m.applied))throw Error('כבר טופל עדכון חדש יותר. מייל ישן לא ישנה את המצב.');
 let patch={received:true};
 if(mail.kind==='חוסרים')patch={missing:true,approved:false};
 if(mail.kind==='אישור'){
  if(d.missing)throw Error('יש להשלים תחילה את החוסרים ולבקש אישור עדכני.');
  if(d.underwritingPending&&(!d.underwriting?.sentAt||d.underwriting.alternative||mail.at<d.underwriting.sentAt))throw Error('נדרש אישור חברה חדש לאחר שליחת תנאי החיתום החתומים.');
  if(d.lastCorrectionAt&&mail.at<d.lastCorrectionAt)throw Error('האישור קודם להשלמת החוסרים. יש לקבל אישור עדכני.');
  // Company evidence cannot overwrite the separately recorded funds checks,
  // including when applying an older demo email containing empty defaults.
  const {fundsConfirmed,receivedAmount,transfer,...execution}=mail.execution||{};
  patch={...execution,policy:d.policy||execution.policy,approved:true,underwritingPending:false};
 }
 return {...client,messages:client.messages.map(m=>m.id===mail.id?{...m,applied:true}:m),decisions:client.decisions.map(item=>item.id===d.id?{...item,...patch}:item)};
}
