import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '../.release/budget-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import {createCalendar,schema as baseSchema,oauthPurposeSchema,SCOPE,eventData,israelTime,calendarConfig} from './calendar.mjs';
const schema=baseSchema+';'+oauthPurposeSchema+';';
const owner='11111111-1111-4111-8111-111111111111';
const env={APP_ENV:'staging',PILOT_CALENDAR_ENABLED:'true',PILOT_MAIL_CLIENT_ID:'test',PILOT_MAIL_CLIENT_SECRET:'test-secret',PILOT_MAIL_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),PILOT_MAIL_REDIRECT_URI:'https://networth-staging-staging.up.railway.app/api/staging/mail/callback'};
const origin=new URL(env.PILOT_MAIL_REDIRECT_URI).origin;
const client={id:'client-test',name:'לקוח בדיקה',appointments:[{id:'appointment-test',title:'פגישת המלצות',when:'2026-09-30T13:00',mode:'טלפון',done:false}]};
function response(){return {statusCode:200,headers:{},cookies:{},status(n){this.statusCode=n;return this;},set(k,v){this.headers[k]=v;return this;},json(v){this.body=v;return this;},sendStatus(n){this.statusCode=n;return this;},cookie(k,v){this.cookies[k]=v;return this;},clearCookie(){},redirect(v){this.redirectTo=v;return this;}};}
test('Israel timezone: summer, winter, invalid and ambiguous times',()=>{assert.equal(new Date(israelTime('2026-09-30T13:00')).toISOString(),'2026-09-30T10:00:00.000Z');assert.equal(new Date(israelTime('2026-12-01T13:00')).toISOString(),'2026-12-01T11:00:00.000Z');for(const v of ['bad','2026-02-30T13:00','2026-03-27T02:30','2026-10-25T01:30'])assert.throws(()=>israelTime(v));});
test('minimal event payload; stable id, no financial notes or invitees',()=>{const a=eventData(owner,{...client,nationalId:'secret',call:'medical notes'},client.appointments[0]);assert.equal(a.body.id,eventData(owner,client,client.appointments[0]).body.id);assert.equal(Date.parse(a.body.end.dateTime)-Date.parse(a.body.start.dateTime),1800000);assert.equal(a.body.attendees,undefined);assert.ok(!JSON.stringify(a).includes('secret'));assert.throws(()=>eventData(owner,client,{...client.appointments[0],done:true}));assert.throws(()=>calendarConfig({...env,APP_ENV:'production'}));});
test('OAuth, calendar and event lifecycle with real local SQL and mocked Google',async()=>{
 const db=new PGlite();await db.exec(`CREATE TABLE users(id uuid PRIMARY KEY);CREATE TABLE staging_crm(owner_id uuid PRIMARY KEY,state jsonb,revision integer DEFAULT 1);${schema}`);await db.query('INSERT INTO users VALUES($1)',[owner]);await db.query('INSERT INTO staging_crm(owner_id,state) VALUES($1,$2)',[owner,JSON.stringify({clients:[client]})]);const pool={query:(sql,args)=>db.query(sql,args),connect:async()=>({query:(sql,args)=>db.query(sql,args),release(){}})};
 let inserts=0,creates=0,codeExchanges=0,wrongAccount=false,ambiguousCreate=false;const remote=new Map();
 const request=async(url,options={})=>{const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  if(url.includes('oauth2.googleapis.com/token')){if(options.body.get('grant_type')==='authorization_code'){codeExchanges++;assert.ok(options.body.get('code_verifier'));}return json({access_token:'access',refresh_token:'refresh-secret',scope:SCOPE});}
  if(url.endsWith('/userinfo'))return json({email:wrongAccount?'other@example.com':'daviddavit55@gmail.com',verified_email:true});
  if(url.endsWith('/calendars')){creates++;if(ambiguousCreate)throw Error('timeout');return json({id:'dedicated-calendar'});}
  if(options.method==='DELETE'){const id=url.split('/').pop().split('?')[0];remote.set(id,{...remote.get(id),status:'cancelled'});return new Response(null,{status:204});}
  if(options.method==='POST'){assert.ok(url.endsWith('?sendUpdates=none'));const data=JSON.parse(options.body);assert.equal(data.attendees,undefined);inserts++;if(remote.has(data.id))return json({},409);const event={...data,htmlLink:'https://calendar.google.com/calendar/event?eid=test'};remote.set(data.id,event);return json(event);}
  const found=remote.get(url.split('/').pop());return json(found||{},found?200:404);
 };
 const api=createCalendar({pool,env,request}),req={user:{id:owner},headers:{origin},body:{clientId:client.id,appointmentId:client.appointments[0].id},method:'POST'};
 const blocked=response();api.guard({...req,headers:{origin:'https://evil.example'}},blocked,()=>assert.fail());assert.equal(blocked.statusCode,403);
 async function authorize(){const start=response();await api.connect(req,start);const url=new URL(start.body.url);assert.ok(url.searchParams.get('scope').includes(SCOPE));assert.ok(!url.searchParams.get('scope').includes('gmail'));return {query:{state:url.searchParams.get('state'),code:'test'},headers:{cookie:'nw_calendar_oauth='+start.cookies.nw_calendar_oauth}};}
 const cb=await authorize(),wrongBrowser=response();await api.callback({...cb,headers:{cookie:'nw_calendar_oauth=wrong'}},wrongBrowser);assert.ok(wrongBrowser.redirectTo.endsWith('failed'));assert.equal(codeExchanges,0);
 const connected=response();await api.callback(cb,connected);assert.ok(connected.redirectTo.endsWith('connected'));const cipher=(await db.query('SELECT token FROM staging_calendar_connections')).rows[0].token;assert.ok(!cipher.includes('refresh-secret'));
 const replay=response();await api.callback(cb,replay);assert.ok(replay.redirectTo.endsWith('failed'));assert.equal(codeExchanges,1);
 const setup=response();await api.setup(req,setup);assert.equal(setup.body.ready,true);await api.setup(req,response());assert.equal(creates,1);
 await api.sync(req,response());await api.sync(req,response());assert.equal(inserts,1);assert.equal(remote.size,1);assert.equal((await db.query('SELECT * FROM staging_calendar_events')).rows.length,1);
 const missing=response();await api.sync({...req,body:{clientId:'other',appointmentId:'missing'}},missing);assert.equal(missing.statusCode,400);assert.equal(remote.size,1);
 const status=response();await api.status(req,status);assert.equal(status.body.ready,true);assert.equal(status.body.events.length,1);assert.ok(!JSON.stringify(status.body).includes('refresh-secret'));
 const preview=response();await api.resetPreview(req,preview);assert.equal(preview.body.events.length,1);
 const resetBody={revision:1,eventIds:preview.body.eventIds,confirmation:'RESET_STAGING_LEADS_AND_OWN_EVENTS'};
 const stale=response();await api.reset({...req,body:{...resetBody,revision:0}},stale);assert.equal(stale.statusCode,409);
 const id=preview.body.eventIds[0],event=remote.get(id);remote.set(id,{...event,extendedProperties:{private:{networthStaging:'foreign'}}});
 const foreign=response();await api.reset({...req,body:resetBody},foreign);assert.equal(foreign.statusCode,400);assert.equal((await db.query('SELECT state FROM staging_crm')).rows[0].state.clients.length,1);
 remote.set(id,event);remote.set('unrelated',{id:'unrelated',status:'confirmed'});
 const reset=response();await api.reset({...req,body:resetBody},reset);assert.equal(reset.body.removedEvents,1);assert.equal(reset.body.removedLeads,1);
 assert.equal(remote.get(id).status,'cancelled');assert.equal(remote.get('unrelated').status,'confirmed');assert.equal((await db.query('SELECT state FROM staging_crm')).rows[0].state.clients.length,0);
 assert.equal((await db.query('SELECT calendar_id FROM staging_calendar_connections')).rows[0].calendar_id,'dedicated-calendar');
 assert.equal((await db.query('SELECT * FROM staging_calendar_events')).rows.length,0);
 wrongAccount=true;const denied=response();await api.callback(await authorize(),denied);assert.ok(denied.redirectTo.endsWith('failed'));
 // If Google may have created the calendar but its response was lost, do not create a duplicate.
 await db.query('UPDATE staging_calendar_connections SET calendar_id=NULL');ambiguousCreate=true;await api.setup(req,response());const retry=response();await api.setup(req,retry);assert.equal(retry.statusCode,409);assert.equal(creates,2);
 await db.close();
});
