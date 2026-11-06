// Only primary-customer data from identity-checked clearinghouse reports belongs here.
export function mergeSourceProfile(client, reports) {
 const candidates=reports.filter(r=>r.source==='maslaka'&&(r.customerProfile||Array.isArray(r.customerEmails)));
 if(!candidates.length)return client;
 const latest=candidates.reduce((a,b)=>a.asOf>=b.asOf?a:b).asOf;
 const previousDate=[client.sourceProfile?.asOf||'',...(client.reports||[]).filter(r=>r.source==='maslaka').map(r=>r.asOf||'')].sort().at(-1);
 if(latest<previousDate)return client;
 const byFingerprint=new Map();
 for(const r of [...(client.reports||[]),...candidates].filter(r=>r.source==='maslaka'&&r.asOf===latest)){
  const key=r.fingerprint||r.id,old=byFingerprint.get(key);byFingerprint.set(key,{...old,...r,id:old?.id||r.id});
 }
 const newest=[...byFingerprint.values()].sort((a,b)=>(a.fingerprint||a.id).localeCompare(b.fingerprint||b.id)), profile={source:'מסלקה — פרטי הלקוח הראשי',asOf:latest,conflicts:[]};
 const emails=[...new Set(newest.flatMap(r=>r.customerEmails||[]))];
 for(const key of ['name','birth','identity']){
  const values=[...new Set(newest.map(r=>r.customerProfile?.[key]).filter(Boolean))];
  if(values.length===1)profile[key]=values[0];
  if(values.length>1)profile.conflicts.push(key==='name'?'שם':key==='birth'?'תאריך לידה':'תעודת זהות');
 }
 profile.conflicts=[...new Set([...profile.conflicts,...newest.flatMap(r=>r.customerProfile?.conflicts||[]),...(emails.length>1?['מייל']:[])])];
 const matching=(client.reports||[]).find(r=>r.source==='maslaka'&&r.fingerprint===newest[0].fingerprint);
 profile.reportId=matching?.id||newest[0].id;
 const email=emails.length===1?emails[0]:emails.length>1?'':client.email||'';
 const next={...client,sourceProfile:profile,email,emailSource:emails.length?profile.source:client.emailSource||'',...(profile.name?{name:profile.name}:{}),...(profile.birth?{birth:profile.birth}:{})};
 const updatedReports=(client.reports||[]).map(old=>{
  const match=newest.find(r=>r.fingerprint&&r.fingerprint===old.fingerprint);
  return match?{...old,customerEmails:match.customerEmails||[],customerProfile:match.customerProfile}:old;
 });
 next.reports=updatedReports;
 if(JSON.stringify(next)===JSON.stringify(client))return client;
 if(next.name!==client.name||next.birth!==client.birth||next.email!==client.email){
  next.sourceProfileHistory=[...(client.sourceProfileHistory||[]),{name:client.name,birth:client.birth,email:client.email,source:client.sourceProfile?.source||'פרטי התיק לפני קליטת המסלקה',asOf:client.sourceProfile?.asOf||null,replacedBy:profile.reportId}];
 }
 return next;
}
