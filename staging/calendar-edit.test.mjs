import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '../.release/budget-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import {createCalendar,schema,eventData} from './calendar.mjs';
import {seal} from '../backend/src/services/gmail.js';
import {appointmentSyncVersion,changeAppointment} from '../.local-preview/appointment-edit.js';
import {saveCrm} from './crm-store.mjs';
const owner='11111111-1111-4111-8111-111111111111',key=Buffer.alloc(32,7);
const env={APP_ENV:'staging',PILOT_CALENDAR_ENABLED:'true',PILOT_MAIL_CLIENT_ID:'test',PILOT_MAIL_CLIENT_SECRET:'test',PILOT_MAIL_ENCRYPTION_KEY:key.toString('base64'),PILOT_MAIL_REDIRECT_URI:'https://networth-staging-staging.up.railway.app/api/staging/mail/callback'};
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;},sendStatus(n){this.statusCode=n;return this;}});
test('calendar edits PATCH same owned event; failures retry safely; cancellation keeps tombstone and audit',async()=>{
 const db=new PGlite();await db.exec(`CREATE TABLE users(id uuid PRIMARY KEY);CREATE TABLE staging_crm(owner_id uuid PRIMARY KEY,state jsonb,revision integer NOT NULL);${schema}`);
 await db.query('INSERT INTO users VALUES($1)',[owner]);await db.query('INSERT INTO staging_calendar_connections(owner_id,email,token,calendar_id) VALUES($1,$2,$3,$4)',[owner,'test',seal({refresh_token:'test'},key,'staging-calendar:'+owner),'owned-calendar']);
 let client={id:'c',name:'Synthetic client',events:[],appointments:[{id:'a',title:'Meeting',type:'המשך טיפול',when:'2026-09-30T13:00',done:false}]};
 await db.query('INSERT INTO staging_crm VALUES($1,$2,1)',[owner,JSON.stringify({clients:[client]})]);
 let failCommit=false;
 let checkedOut=false;
 const locks=[],pool={query:(s,a)=>{assert.equal(checkedOut,false,'calendar sync must not acquire a second pooled client');return db.query(s,a);},connect:async()=>{checkedOut=true;return {query:(s,a)=>{if(s.includes('advisory'))locks.push(a[0]);if(s==='COMMIT'&&failCommit){failCommit=false;throw Error('synthetic commit failure');}return db.query(s,a);},release(){checkedOut=false;}};}};
 const remote=new Map(),writes=[];let losePatch=false,denyPatch=false;
 const request=async(url,opts={})=>{
  const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json'}});
  if(url.includes('oauth2.googleapis.com/token'))return json({access_token:'token'});
  const id=url.split('/').at(-1).split('?')[0];
  if(opts.method==='POST'){const data=JSON.parse(opts.body);writes.push(['POST',data.id]);assert.equal(data.attendees,undefined);const event={...data,etag:'v1',htmlLink:'https://calendar.google.com/calendar/event?eid=synthetic'};remote.set(data.id,event);return json(event);}
  if(opts.method==='PATCH'){writes.push(['PATCH',id]);assert.equal(opts.headers['If-Match'],remote.get(id).etag);assert.ok(url.endsWith('?sendUpdates=none'));if(denyPatch)return json({},403);const next={...remote.get(id),...JSON.parse(opts.body),etag:'v'+writes.length};remote.set(id,next);if(losePatch){losePatch=false;throw Error('lost response');}return json(next);}
  if(opts.method==='DELETE'){writes.push(['DELETE',id]);assert.equal(opts.headers['If-Match'],remote.get(id).etag);remote.set(id,{...remote.get(id),status:'cancelled'});return new Response(null,{status:204});}
  return json(remote.get(id)||{},remote.has(id)?200:404);
 };
 const api=createCalendar({pool,env,request});
 const sync=async(expectedVersion=appointmentSyncVersion(client,client.appointments[0]))=>{const res=response();await api.sync({user:{id:owner},body:{clientId:'c',appointmentId:'a',expectedVersion}},res);return res;};
 const save=async(next)=>{const revision=(await db.query('SELECT revision FROM staging_crm')).rows[0].revision,res=response();await saveCrm({pool})({user:{id:owner},body:{revision,state:{clients:[next]}}},res);assert.equal(res.statusCode,200);client=next;};
 failCommit=true;assert.equal((await sync()).statusCode,500);assert.equal((await db.query('SELECT * FROM staging_calendar_events')).rows.length,0,'failed transaction must never be acknowledged');
 assert.equal((await sync()).statusCode,200);const id=eventData(owner,client,client.appointments[0]).body.id;
 const oldVersion=appointmentSyncVersion(client,client.appointments[0]);
 await save(changeAppointment(client,'a',{title:'Updated meeting',type:'המשך טיפול',when:'2026-10-01T14:00',mode:'טלפון'}));
 assert.equal((await sync(oldVersion)).statusCode,409);assert.equal(writes.length,1);
 denyPatch=true;assert.equal((await sync()).statusCode,400);assert.equal((await db.query('SELECT source_version FROM staging_calendar_events')).rows[0].source_version,oldVersion);
 denyPatch=false;losePatch=true;assert.equal((await sync()).statusCode,400);const count=writes.length;
 assert.equal((await sync()).statusCode,200);assert.equal(writes.length,count,'retry reads committed remote edit without duplicate PATCH/POST');assert.equal(remote.size,1);assert.equal(remote.get(id).summary.includes('Updated meeting'),true);
 remote.get(id).extendedProperties.private.networthStaging='foreign';await save(changeAppointment(client,'a',{title:'Blocked foreign',type:'המשך טיפול',when:'2026-10-02T14:00',mode:'טלפון'}));assert.equal((await sync()).statusCode,400);assert.equal(writes.length,count);
 remote.get(id).extendedProperties=eventData(owner,client,client.appointments[0]).body.extendedProperties;
 await save(changeAppointment(client,'a',{cancelled:true,reason:'Synthetic cancellation'}));assert.equal((await sync()).body.cancelled,true);assert.equal((await sync()).body.cancelled,true);
 assert.equal(writes.filter(w=>w[0]==='POST').length,1);assert.equal(writes.filter(w=>w[0]==='DELETE').length,1);assert.equal((await db.query('SELECT sync_status FROM staging_calendar_events')).rows[0].sync_status,'cancelled');
 const stored=(await db.query('SELECT state FROM staging_crm')).rows[0].state.clients[0].appointments[0];assert.equal(stored.cancelled,true);assert.equal(stored.history.length,3);assert.equal(stored.history.at(-1).reason,'Synthetic cancellation');assert.throws(()=>changeAppointment(client,'a',{title:'Resurrect'}));
 assert.ok(locks.length>3);assert.ok(locks.every(x=>x===owner));
 const stale=response();await saveCrm({pool})({user:{id:owner},body:{revision:1,state:{clients:[]}}},stale);assert.equal(stale.statusCode,409);assert.equal((await db.query('SELECT state FROM staging_crm')).rows[0].state.clients.length,1);
 await db.close();
});
