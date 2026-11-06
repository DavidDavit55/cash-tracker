// One stored file can serve several checkpoints without another upload.
export function processDocuments(d, kit=[]) {
 const records=[...kit.map(doc=>({label:doc.name,file:d.kit?.[doc.id]?.file})),
  {label:'הפוליסה שהופקה / אישור הקרן',file:d.policyDocument},
  {label:'נספח ו׳ לחשבת שכר',file:d.transfer?.annex},
  {label:'טופס קוביות לחשבת שכר',file:d.transfer?.cubes},
  {label:'אסמכתת קליטת כספי ניוד',file:d.transfer?.document},
  {label:'תנאי חיתום מקוריים',file:d.underwriting?.source},
  {label:'תנאי חיתום חתומים',file:d.underwriting?.file},
  {label:'השלמת חוסרים',file:d.correctionDocument},
  ...Object.entries(d.taskEvidence||{}).map(([key,file])=>({label:['cancel','cancelCheck'].includes(key)?'אישור ביטול בפועל':key==='verify'?'אסמכתת בדיקת הפקה':key,file}))];
 const unique=new Map();
 for(const record of records){
  if(!record.file?.data||!/^data:(?:application\/pdf|image\/(?:png|jpeg)|text\/plain)(?:;|,)/.test(record.file.data))continue;
  const key=record.file.sha256||record.file.data;
  if(unique.has(key))unique.get(key).labels.push(record.label);
  else unique.set(key,{labels:[record.label],file:record.file});
 }
 return [...unique.values()].map(r=>({...r,label:[...new Set(r.labels)].join(' · ')}));
}
