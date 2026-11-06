// Staging only. Export existing CRM tasks; never import completion or send mail.
import assert from 'node:assert/strict';
const base='https://networth-staging-staging.up.railway.app';
const call=(path,options={})=>fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(30000),...options});
assert.equal((await (await call('/api/health')).json()).environment,'staging');
const unlock=await call('/__staging/unlock',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({key:process.env.STAGING_LOGIN_PASSWORD})});
assert.equal(unlock.status,302);
const cookie=unlock.headers.get('set-cookie').split(';')[0];
const session=await call('/__staging/session',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:'role=admin'});
const token=JSON.parse((await session.text()).match(/setItem\('token',(.*?)\);/)[1]);
const headers={Cookie:cookie,Authorization:'Bearer '+token,Origin:base,'Content-Type':'application/json'};
const before=await (await call('/api/staging/crm',{headers})).json();
for(let run=1;run<=2;run++){
 const r=await call('/api/staging/tasks/sync',{method:'POST',headers,body:JSON.stringify({revision:before.revision,exportOnly:true})});
 const result=await r.json();
 console.log(JSON.stringify({run,status:r.status,code:result.code,error:result.error,created:result.created,updated:result.updated,completed:result.completed,open:result.open}));
 if(!r.ok){process.exitCode=2;break;}
 if(run===2){assert.equal(result.created,0);assert.equal(result.updated,0);assert.equal(result.completed,0);}
}
const after=await (await call('/api/staging/crm',{headers})).json();
assert.equal(JSON.stringify(before),JSON.stringify(after));
console.log('PASS: CRM unchanged; no imported completions or mail');
