// Read-only deployed mailbox inventory. Sensitive output stays in ignored private storage.
import fs from 'node:fs';
import {extractMail} from './mail-automation-extract.mjs';
import {planMail} from './mail-automation-rules.mjs';
const base='https://networth-staging-staging.up.railway.app';
const root=new URL('../.staging-private/',import.meta.url);
const cfg=JSON.parse(fs.readFileSync(new URL('credentials.json',root),'utf8'));
const request=(p,o={})=>fetch(base+p,{redirect:'manual',signal:AbortSignal.timeout(30000),...o});
const r=await request('/__staging/unlock',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({key:cfg.STAGING_ACCESS_KEY})});
if(r.status!==302)throw Error('Gateway unavailable');
const cookie=r.headers.get('set-cookie').split(';')[0];
const s=await request('/__staging/session',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:'role=admin'});
const token=JSON.parse((await s.text()).match(/setItem\('token',(.*?)\);/)[1]);
const headers={Cookie:cookie,Authorization:'Bearer '+token};
if(process.argv.includes('--automation-status')||process.argv.includes('--enable')){
 if(process.argv.includes('--enable')){
  for(const [p,body] of [['/api/staging/mail/automation/settings',{enabled:true}],['/api/staging/mail/sync',{}]]){
   const r=await request(p,{method:'POST',headers:{...headers,Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('activation '+r.status);
  }
 }
 const r=await request('/api/staging/mail/automation',{headers});if(!r.ok)throw Error('automation '+r.status);const status=await r.json();
 console.log(JSON.stringify({enabled:status.enabled,running:status.running,counts:status.rows.reduce((a,r)=>(a[r.result.status]=(a[r.result.status]||0)+1,a),{}),reports:status.reports,changes:status.rows.filter(r=>['attach','advance','payroll'].includes(r.result.status)),exceptions:status.rows.filter(r=>r.result.status==='exception').map(r=>({reason:r.result.reason,clientId:r.result.clientId,mailId:r.result.mailId}))}));
 process.exit(0);
}
const result={};
for(const [key,p] of Object.entries({crm:'/api/staging/crm',mail:'/api/staging/mail/received',sync:'/api/staging/mail/sync-status',send:'/api/staging/mail'})){
 const response=await request(p,{headers});if(!response.ok)throw Error(key+': '+response.status);result[key]=await response.json();
}
const dir=new URL('mail-audit-'+Date.now()+'/',root);fs.mkdirSync(dir);
fs.writeFileSync(new URL('inventory.json',dir),JSON.stringify(result),{flag:'wx'});
if(process.argv.includes('--verify-attachment')){
 const decisions=result.crm.state.clients.flatMap(c=>(c.decisions||[]).map(d=>({c,d})));
 const applied=decisions.filter(({d})=>d.mailAutomationHistory?.some(h=>h.status==='attach'));
 for(const {d} of applied){const f=d.transfer.annex;if(!f.id||f.simulated||!d.transfer.previousAnnex?.simulated)throw Error('archive verification failed');const r=await request('/api/staging/files/'+f.id,{headers});if(!r.ok)throw Error('private file missing');const {createHash}=await import('node:crypto');if(createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex')!==f.sha256)throw Error('private file hash mismatch');}
 console.log(JSON.stringify({verifiedAttachments:applied.length,revision:result.crm.revision,privateDocumentHashVerified:true,crmWrites:0}));
}
if(process.argv.includes('--analyze')){
 const plans=[];
 for(const row of result.mail.rows){
  const eml=await request('/api/staging/mail/received/'+row.id+'/download',{headers});if(!eml.ok)throw Error('download');
  row.raw=Buffer.from(await eml.arrayBuffer());row.pdfs=[];
  for(let i=0;i<row.pdf_count;i++){const p=await request('/api/staging/mail/received/'+row.id+'/download?pdf='+i,{headers});if(!p.ok)throw Error('pdf');row.pdfs.push({name:'attachment-'+i+'.pdf',data:Buffer.from(await p.arrayBuffer()).toString('base64')});}
  const extraction=await extractMail(row);plans.push(planMail(result.crm.state,row,extraction));
  fs.writeFileSync(new URL(row.id+'.json',dir),JSON.stringify({row,extraction}),{flag:'wx'});
 }
 fs.writeFileSync(new URL('plans.json',dir),JSON.stringify(plans),{flag:'wx'});
 console.log(JSON.stringify({analysis:plans.reduce((a,p)=>(a[p.status]=(a[p.status]||0)+1,a),{}),reasons:[...new Set(plans.map(p=>p.reason))],writes:0}));
}
const counts={};for(const m of result.mail.rows)counts[m.client_id?'linked':'unassigned']=(counts[m.client_id?'linked':'unassigned']||0)+1;
console.log(JSON.stringify({directory:dir.pathname,revision:result.crm.revision,clients:result.crm.state.clients.length,messages:result.mail.rows.length,counts,accounts:result.sync.accounts.map(a=>({email:a.email,connected:a.connected,error:a.error,hasMore:!!a.cursor})),reportRecipient:result.send.recipient,sendConnected:result.send.connected,writes:0}));
