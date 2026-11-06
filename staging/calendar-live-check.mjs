// Staging calendar only; never reset, modify CRM, or invite attendees.
import assert from 'node:assert/strict';
import {appointmentSyncVersion} from '../.local-preview/appointment-edit.js';
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
const status=await (await call('/api/staging/calendar',{headers})).json();
console.log(JSON.stringify({connected:status.connected,ready:status.ready,mappedEvents:status.events?.length}));
const appointments=before.state.clients.flatMap(c=>(c.appointments||[]).filter(a=>!a.done&&!a.cancelled).map(a=>({clientId:c.id,appointmentId:a.id,expectedVersion:appointmentSyncVersion(c,a)})));
let failed=false,previous;
for(let run=1;run<=2;run++){
 for(const appointment of appointments){
  const r=await call('/api/staging/calendar/events',{method:'POST',headers,body:JSON.stringify(appointment)}),result=await r.json();
  if(!r.ok){console.log(JSON.stringify({run,status:r.status,error:result.error}));failed=true;break;}
 }
 if(failed)break;
 // This endpoint only reads linked remote events; the reset POST is never used.
 const r=await call('/api/staging/calendar/reset-preview',{headers}),result=await r.json();
 if(!r.ok){console.log(JSON.stringify({run,readStatus:r.status,error:result.error}));failed=true;break;}
 const snapshot=result.events.map(({appointment_key,event_id,event})=>({key:appointment_key,id:event_id,status:event.status,etag:event.etag,start:event.start,end:event.end})).sort((a,b)=>a.id.localeCompare(b.id));
 assert.equal(new Set(snapshot.map(e=>e.id)).size,snapshot.length);
 assert.equal(new Set(snapshot.map(e=>e.key)).size,snapshot.length);
 if(previous)assert.deepEqual(snapshot,previous,'Second sync changed linked remote events');
 previous=snapshot;
 console.log(JSON.stringify({run,status:200,syncedAppointments:appointments.length,linkedEvents:snapshot.length,unchangedFromPrevious:run===2}));
}
const after=await (await call('/api/staging/crm',{headers})).json();
assert.equal(JSON.stringify(before),JSON.stringify(after));
console.log('PASS: CRM unchanged; no reset, invitations or production calls');
if(failed)process.exitCode=2;
