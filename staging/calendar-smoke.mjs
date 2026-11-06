// Live read-only verification. Does not request Google consent or create events.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base='https://networth-staging-staging.up.railway.app';
const credentials=JSON.parse(fs.readFileSync(new URL('../.staging-private/credentials.json',import.meta.url),'utf8'));
async function request(path,options={}){return fetch(base+path,{...options,redirect:'manual',signal:AbortSignal.timeout(20000)});}
const health=await (await request('/api/health')).json();assert.equal(health.calendarPilot,true);assert.equal(health.externalSends,false);
assert.equal((await request('/api/staging/calendar')).status,401);
const unlock=await request('/__staging/unlock',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({key:credentials.STAGING_ACCESS_KEY})});assert.equal(unlock.status,302);const Cookie=unlock.headers.get('set-cookie').split(';')[0];
async function login(role){const r=await request('/__staging/session',{method:'POST',headers:{Cookie,Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({role})});assert.equal(r.status,200);return JSON.parse((await r.text()).match(/setItem\('token',(.*?)\);/)[1]);}
const token=await login('admin'),client=await login('client');const headers={Cookie,Authorization:'Bearer '+token};
assert.equal((await request('/api/staging/calendar',{headers:{Cookie,Authorization:'Bearer '+client}})).status,403);
const status=await request('/api/staging/calendar',{headers});assert.equal(status.status,200);const state=await status.json();assert.equal(state.email,'daviddavit55@gmail.com');
const tasks=await request('/api/staging/tasks',{headers});assert.equal(tasks.status,200);assert.equal(typeof (await tasks.json()).connected,'boolean');
const mailStatus=await request('/api/staging/mail',{headers});assert.equal(mailStatus.status,200);assert.equal((await mailStatus.json()).recipient,'davidsdreams55@gmail.com');
assert.equal((await request('/api/staging/mail',{headers:{Cookie,Authorization:'Bearer '+client}})).status,403);
const mailHistory=await request('/api/staging/mail/history?clientId=smoke-nonexistent',{headers});assert.equal(mailHistory.status,200);assert.deepEqual((await mailHistory.json()).rows,[]);
assert.equal((await request('/api/staging/mail/payroll',{method:'POST',headers:{...headers,Origin:'https://invalid.example','Content-Type':'application/json'},body:'{}'})).status,403);
assert.equal((await request('/api/staging/mail/eml/nonexistent',{headers})).status,404);
assert.equal((await request('/api/staging/tasks',{headers:{Cookie,Authorization:'Bearer '+client}})).status,403);
assert.equal((await request('/api/staging/tasks/sync',{method:'POST',headers:{...headers,Origin:'https://invalid.example','Content-Type':'application/json'},body:'{}'})).status,403);
assert.equal((await request('/api/staging/calendar/events',{method:'POST',headers:{...headers,Origin:'https://invalid.example','Content-Type':'application/json'},body:'{}'})).status,403);
assert.equal((await request('/api/admin/gmail/status',{headers})).status,403);
const callback=await request('/api/staging/mail/callback?state=invalid&code=invalid');assert.equal(callback.status,302);assert.equal(callback.headers.get('location'),'/admin/crm?calendar=failed');
const html=await (await request('/admin/crm',{headers})).text();const main=html.match(/src="([^"]+\/index-[^"]+\.js)"/)[1];const js=await (await request(main,{headers})).text();assert.match(js,/StagingCrm-/);
const chunk=js.match(/(?:\.\/)?assets\/(StagingCrm-[\w-]+\.js)/)?.[1]||js.match(/(StagingCrm-[\w-]+\.js)/)?.[1];assert.ok(chunk);const crm=await (await request('/assets/'+chunk,{headers})).text();assert.ok(crm.includes('חיבור היומן האישי בגוגל'));
console.log(JSON.stringify({result:'PASS',calendarConfigured:true,connected:state.connected,calendarReady:state.ready,privateGate:true,clientBlocked:true,foreignOriginBlocked:true,invalidCallbackRejected:true,calendarUIInLiveBundle:true,mailStillBlocked:true,googleEventsCreatedByTest:0}));
