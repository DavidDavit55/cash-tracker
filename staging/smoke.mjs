import fs from 'node:fs';
import assert from 'node:assert/strict';
const base='https://networth-staging-staging.up.railway.app';
const credentials=JSON.parse(fs.readFileSync(new URL('../.staging-private/credentials.json',import.meta.url),'utf8'));
let cookie='';
async function request(route,{token,body,method='GET',gate=true,...rest}={}){return fetch(base+route,{method,redirect:'manual',headers:{...(gate&&cookie?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),...rest.headers},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});}
assert.equal((await request('/api/health')).status,200);
assert.equal((await request('/admin/crm',{gate:false})).status,401);
assert.equal((await request('/api/staging/crm',{gate:false})).status,401);
const unlock=await fetch(base+'/__staging/unlock',{method:'POST',redirect:'manual',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({key:credentials.STAGING_ACCESS_KEY})});
assert.equal(unlock.status,302);cookie=unlock.headers.get('set-cookie').split(';')[0];
assert.match(unlock.headers.get('set-cookie'),/HttpOnly/i);assert.match(unlock.headers.get('set-cookie'),/Secure/i);
async function session(role){const r=await fetch(base+'/__staging/session',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({role})});assert.equal(r.status,200);return JSON.parse((await r.text()).match(/setItem\('token',(.*?)\);/)[1]);}
const admin=await session('admin'),client=await session('client');
assert.equal((await (await request('/api/auth/me',{token:admin})).json()).email,'staging-admin@example.invalid');
assert.equal((await request('/api/admin/clients',{token:admin})).status,200);
assert.equal((await request('/api/admin/clients',{token:client})).status,403);
assert.equal((await request('/api/staging/crm',{token:client})).status,403);
assert.equal((await request('/api/auth/register',{method:'POST',body:{},token:admin})).status,403);
assert.equal((await request('/api/admin/whatsapp',{token:admin})).status,403);
assert.equal((await request('/api/budget-workspace/overview?period=2026-09',{token:admin})).status,200);
assert.equal((await request('/api/client-profile/financial-data',{token:client})).status,200);
const incomeResponse=await request('/api/budget-workspace/cash',{method:'POST',token:admin,body:{kind:'income',date:'2026-09-29',amount:17.42,label:'staging smoke synthetic',source:'אחר'}});assert.equal(incomeResponse.status,200);const income=await incomeResponse.json();
try{assert.ok(!(await (await request('/api/incomes',{token:client})).json()).some(x=>x.id===income.id));await request('/api/incomes/'+income.id,{method:'DELETE',token:client});assert.ok((await (await request('/api/incomes',{token:admin})).json()).some(x=>x.id===income.id));}finally{assert.equal((await request('/api/incomes/'+income.id,{method:'DELETE',token:admin})).status,200);}
const original=await (await request('/api/staging/crm',{token:admin})).json();
const changed=await request('/api/staging/crm',{method:'PUT',token:admin,body:{revision:original.revision,state:{...original.state,stagingSmoke:'persistence-check'}}});assert.equal(changed.status,200);const revision=(await changed.json()).revision;
try{assert.equal((await (await request('/api/staging/crm',{token:admin})).json()).state.stagingSmoke,'persistence-check');assert.equal((await request('/api/staging/crm',{method:'PUT',token:admin,body:original})).status,409);}finally{assert.equal((await request('/api/staging/crm',{method:'PUT',token:admin,body:{revision,state:original.state}})).status,200);}
console.log('PASS: health, private gateway, cookie security, admin/client separation, integration blocks, budget, client portal API, CRM persistence and stale-write rejection. Synthetic CRM test marker removed.');
