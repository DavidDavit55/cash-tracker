// Prefill only: evidence never implies verification or completion.
export function inboundTransferDefaults(d,p,mails=[]){
 const mail=mails.find(m=>m.id===d.companyReport?.mailId&&m.decisionId===d.id&&m.identityConfirmed&&m.appliedAt);
 if(!mail?.pdf?.id||mail.report?.kind!=='completed'||mail.report.sourcePolicy!==p.policy)return {};
 const r=mail.report;
 if(r.amount===''||r.amount==null||!Number.isFinite(Number(r.amount))||Number(r.amount)<0||!/^\d{4}-\d{2}-\d{2}$/.test(r.effective||'')||!r.targetPolicy)return {};
 return {received:String(r.amount),receivedDate:r.effective,reportedTargetPolicy:r.targetPolicy,inboundMailId:mail.id,document:{...mail.pdf,privateFile:true,data:'/api/staging/files/'+encodeURIComponent(mail.pdf.id)}};
}
export function transferDraftWithEvidence(d,p,mails){
 const defaults=inboundTransferDefaults(d,p,mails),saved=d.transfer||{};
 return {...defaults,...saved,received:saved.received!==undefined&&saved.received!==''?saved.received:defaults.received,receivedDate:saved.receivedDate||defaults.receivedDate,document:saved.document?.data?saved.document:defaults.document};
}
