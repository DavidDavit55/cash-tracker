// Explicit operator action, not part of the release. Backup precedes the authorized reset.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base='https://networth-staging-staging.up.railway.app';
const credentials=JSON.parse(fs.readFileSync(new URL('../.staging-private/credentials.json',import.meta.url),'utf8'));
const unlock=await fetch(base+'/__staging/unlock',{method:'POST',redirect:'manual',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({key:credentials.STAGING_ACCESS_KEY})});assert.equal(unlock.status,302);
const Cookie=unlock.headers.get('set-cookie').split(';')[0];
const session=await fetch(base+'/__staging/session',{method:'POST',headers:{Cookie,Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({role:'admin'})});assert.equal(session.status,200);
const token=JSON.parse((await session.text()).match(/setItem\('token',(.*?)\);/)[1]);
async function request(route,body){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{Cookie,Authorization:'Bearer '+token,Origin:base,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error('Pilot request failed: '+r.status);return r.json();}
const crm=await request('/api/staging/crm'),calendar=await request('/api/staging/calendar/reset-preview');
console.log(JSON.stringify({preview:true,leads:crm.state.clients.length,archivedLeads:crm.state.deletedClients?.length||0,registeredEvents:calendar.eventIds.length,activeEvents:calendar.events.filter(e=>e.event.status!=='cancelled').length,revision:crm.revision}));
if(process.argv.includes('--execute')){
 const name='pilot-reset-'+new Date().toISOString().replaceAll(':','-')+'.json';
 const file=new URL('../.staging-private/'+name,import.meta.url);
 fs.writeFileSync(file,JSON.stringify({at:new Date().toISOString(),crm,calendar},null,2),{flag:'wx',mode:0o600});
 assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).crm.revision,crm.revision);
 const result=await request('/api/staging/calendar/reset',{revision:crm.revision,eventIds:calendar.eventIds,confirmation:'RESET_STAGING_LEADS_AND_OWN_EVENTS'});
 const after=await request('/api/staging/crm'),connection=await request('/api/staging/calendar');
 assert.equal(after.state.clients.length,0);assert.equal(after.state.deletedClients.length,0);assert.equal(connection.ready,true);assert.equal(connection.events.length,0);
 console.log(JSON.stringify({result,verifiedEmpty:true,connectionPreserved:true,backup:name}));
}
