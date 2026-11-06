import test from 'node:test';
import assert from 'node:assert/strict';
import {createTasks} from './tasks.mjs';
import {createCalendar} from './calendar.mjs';
import {seal} from '../backend/src/services/gmail.js';

const owner='11111111-1111-4111-8111-111111111111',key=Buffer.alloc(32,7);
const env={APP_ENV:'staging',PILOT_CALENDAR_ENABLED:'true',PILOT_MAIL_CLIENT_ID:'test',PILOT_MAIL_CLIENT_SECRET:'test',PILOT_MAIL_ENCRYPTION_KEY:key.toString('base64'),PILOT_MAIL_REDIRECT_URI:'https://networth-staging-staging.up.railway.app/api/staging/mail/callback'};
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(body){assert.equal(this.headersSent,undefined,'only one HTTP response');this.body=body;this.headersSent=true;return this;}});
const json=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
const request=async url=>url.includes('oauth2.googleapis.com/token')?json({access_token:'test'}):json({items:[]});
const req={user:{id:owner},body:{}};

// A tiny, deliberately bounded pool. It rejects pool.query entirely so a sync that
// attempts to borrow another slot under its owner lock cannot pass unnoticed.
function boundedPool({unlockFailure=false,rollbackFailure=false}={}){
 let active=0,maximum=0,ownerLock=null,next=0;const waiters=[],released=[],queries=[];
 const pool={query(){throw Error('Nested pool.query during synchronization');},async connect(){
  if(active>=2)await new Promise(resolve=>waiters.push(resolve));
  active++;maximum=Math.max(maximum,active);const id=++next;let isReleased=false;
  return {async query(sql){
   queries.push(sql);
   if(sql==='SELECT 1 AS probe')return {rows:[{probe:1}]};
   if(sql==='BEGIN')return {rows:[]};
   if(sql.includes('pg_try_advisory')){const acquired=ownerLock===null;if(acquired)ownerLock=id;return {rows:[{acquired}]};}
   if(sql.includes('pg_advisory_unlock')){if(unlockFailure)throw Error('synthetic unlock failure');if(ownerLock===id)ownerLock=null;return {rows:[{pg_advisory_unlock:true}]};}
   if(sql==='ROLLBACK'||sql==='COMMIT'){if(sql==='ROLLBACK'&&rollbackFailure)throw Error('synthetic rollback failure');if(ownerLock===id)ownerLock=null;return {rows:[]};}
   if(sql.includes('FROM staging_tasks_connections'))return {rows:[{list_id:'test-list',token:seal({refresh_token:'test'},key,'staging-tasks:'+owner)}]};
   if(sql.includes('FROM staging_calendar_connections'))return {rows:[{calendar_id:'test-calendar',token:seal({refresh_token:'test'},key,'staging-calendar:'+owner)}]};
   if(sql.includes('FROM staging_crm'))return {rows:[{revision:1,state:{clients:[]}}]};
   if(sql.includes('FROM staging_tasks_items')||sql.includes('FROM staging_calendar_events'))return {rows:[]};
   throw Error('Unexpected SQL: '+sql);
  },release(error){assert.equal(isReleased,false,'client released once');isReleased=true;released.push(error);if(error&&ownerLock===id)ownerLock=null;active--;waiters.shift()?.();}};
 }};
 return {pool,released,queries,get active(){return active;},get maximum(){return maximum;},get ownerLock(){return ownerLock;}};
}

test('overlapping Tasks/calendar/reset syncs fail busy without starving a two-slot pool',async()=>{
 const fixture=boundedPool();let notifyStarted,unblock;
 const started=new Promise(resolve=>notifyStarted=resolve),gate=new Promise(resolve=>unblock=resolve);
 const tasks=createTasks({pool:fixture.pool,env,request:async url=>{if(url.includes('oauth2.googleapis.com/token')){notifyStarted();await gate;}return request(url);}});
 let calendarCalls=0;
 const calendar=createCalendar({pool:fixture.pool,env,request:async()=>{calendarCalls++;throw Error('busy requests must not reach Google');}});
 const first=response(),running=tasks.sync(req,first);await started;
 const attempts=Array.from({length:12},(_,index)=>{const res=response();const call=index%3===0?calendar.sync(req,res):index%3===1?calendar.reset({...req,body:{revision:1,eventIds:[],confirmation:'RESET_STAGING_LEADS_AND_OWN_EVENTS'}},res):tasks.sync(req,res);return call.then(()=>res);});
 const results=await Promise.all(attempts);
 for(const res of results){assert.equal(res.statusCode,503);assert.equal(res.body.code,'sync_busy');assert.equal(res.body.retryable,true);}
 const probe=await fixture.pool.connect();assert.equal((await probe.query('SELECT 1 AS probe')).rows[0].probe,1);probe.release();
 assert.equal(calendarCalls,0);assert.equal(fixture.active,1);assert.equal(fixture.maximum,2);
 unblock();await running;assert.equal(first.statusCode,200);assert.equal(fixture.active,0);assert.equal(fixture.ownerLock,null);
 assert.equal(fixture.queries.filter(sql=>sql.includes('pg_advisory_unlock')).length,1,'busy clients never unlock the active owner');
});

test('Tasks destroys the checked-out client even when advisory unlock fails',async()=>{
 const fixture=boundedPool({unlockFailure:true}),res=response();
 await createTasks({pool:fixture.pool,env,request}).sync(req,res);
 assert.equal(res.statusCode,200);assert.equal(fixture.active,0);assert.equal(fixture.released.length,1);assert.match(fixture.released[0].message,/unlock failure/);assert.equal(fixture.ownerLock,null);
});

for(const action of ['sync','reset'])test(`calendar ${action} destroys client when rollback fails`,async()=>{
 const fixture=boundedPool({rollbackFailure:true}),res=response();
 const api=createCalendar({pool:fixture.pool,env,request:async()=>{throw Error('synthetic Google outage');}});
 await api[action]({...req,body:action==='reset'?{revision:1,eventIds:[],confirmation:'RESET_STAGING_LEADS_AND_OWN_EVENTS'}:{}},res);
 assert.ok(res.statusCode>=400);assert.equal(fixture.active,0);assert.equal(fixture.released.length,1);assert.match(fixture.released[0].message,/rollback failure/);assert.equal(fixture.ownerLock,null);
});
