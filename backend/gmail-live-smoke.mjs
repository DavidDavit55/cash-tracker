// Public endpoints only. No user sessions, Google consent or inbox access.
const base='https://cash-tracker-production-35dd.up.railway.app/api';
try{
 for(const [p,expected] of [['/health',200],['/admin/gmail/status',401],['/admin/gmail/messages',401],['/admin/gmail/authorize',400],['/admin/gmail/callback',303]]){
  const r=await fetch(base+p,{redirect:'manual'});
  console.log(JSON.stringify({path:p,status:r.status,location:r.headers.get('location')}));
  if(r.status!==expected)throw new Error('status');
 }
 const origin='https://networth.davit-fin.co.il';
 const r=await fetch(origin+'/admin/mail'),html=await r.text();
 const asset=html.match(/src="([^"]+\.js)"/);
 if(r.status!==200||!asset)throw new Error('frontend');
 const js=await(await fetch(new URL(asset[1],origin))).text();
 const checks={frontend:r.status,asset:asset[1],hasMailboxUI:js.includes('התיבות שלך'),hasTriageUI:js.includes('פרסומות ומוסתרים'),hasMailboxField:js.includes('mailbox'),hasProdApi:js.includes(base)};
 console.log(JSON.stringify(checks));
 if(!checks.hasMailboxUI||!checks.hasTriageUI||!checks.hasMailboxField||!checks.hasProdApi||!js.includes('סריקת גוף למיילים קיימים'))throw new Error('bundle');
}catch{console.error('Public smoke check failed');process.exitCode=1;}
