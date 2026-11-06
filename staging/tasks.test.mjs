import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '../.release/budget-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import {createTasks,tasksSchema,TASKS_SCOPE,operationalProjection} from './tasks.mjs';
import {createCalendar,schema,oauthPurposeSchema} from './calendar.mjs';
import {applyTaskCompletions,taskVersion,externalTaskCompletionAllowed} from '../.local-preview/task-sync.js';
const owner='11111111-1111-4111-8111-111111111111';
const env={APP_ENV:'staging',PILOT_CALENDAR_ENABLED:'true',PILOT_MAIL_CLIENT_ID:'test',PILOT_MAIL_CLIENT_SECRET:'test',PILOT_MAIL_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),PILOT_MAIL_REDIRECT_URI:'https://networth-staging-staging.up.railway.app/api/staging/mail/callback'};
const response=()=>({statusCode:200,cookies:{},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;},set(){return this;},cookie(k,v){this.cookies[k]=v;},clearCookie(){},redirect(v){this.url=v;}});
test('Tasks isolated OAuth, creation, idempotence, completion and lost response recovery',async()=>{
 const db=new PGlite();await db.exec(`CREATE TABLE users(id uuid PRIMARY KEY);CREATE TABLE staging_crm(owner_id uuid PRIMARY KEY,state jsonb,revision integer DEFAULT 1);${schema};${oauthPurposeSchema};${tasksSchema}`);await db.query('INSERT INTO users VALUES($1)',[owner]);
 let checkedOut=false;
 const pool={query:(s,a)=>{assert.equal(checkedOut,false,'sync must not acquire a second pooled client');return db.query(s,a);},connect:async()=>{checkedOut=true;return {query:(s,a)=>db.query(s,a),release(){checkedOut=false;}};}};
 let posts=0,lists=0,lose=false;const remote=new Map([['foreign',{id:'foreign',title:'personal',status:'needsAction'}]]);
 const request=async(url,o={})=>{const json=d=>new Response(JSON.stringify(d),{headers:{'Content-Type':'application/json'}});
  if(url.includes('oauth2.googleapis.com/token'))return json({access_token:'access',refresh_token:'refresh',scope:TASKS_SCOPE});
  if(url.endsWith('/userinfo'))return json({email:'daviddavit55@gmail.com',verified_email:true});
  if(url.endsWith('/users/@me/lists')){lists++;return json({id:'dedicated'});}
  assert.ok(url.includes('/lists/dedicated/tasks'));
  if(o.method==='POST'){posts++;const t={...JSON.parse(o.body),id:'task'+posts};remote.set(t.id,t);if(lose){lose=false;throw Error('timeout');}return json(t);}
  if(o.method==='PATCH'){const id=url.split('/').pop();assert.notEqual(id,'foreign');const t={...remote.get(id),...JSON.parse(o.body)};remote.set(id,t);return json(t);}
  return json({items:[...remote.values()]});
 };
 const calendar=createCalendar({pool,env,request}),api=createTasks({pool,env,request}),req={user:{id:owner},headers:{origin:new URL(env.PILOT_MAIL_REDIRECT_URI).origin},method:'POST'};
 const start=response();await calendar.tasksConnect(req,start);const u=new URL(start.body.url);assert.ok(u.searchParams.get('scope').includes(TASKS_SCOPE));assert.ok(!u.searchParams.get('scope').includes('calendar.app'));
 const cb=response();await calendar.callback({query:{state:u.searchParams.get('state'),code:'x'},headers:{cookie:'nw_calendar_oauth='+start.cookies.nw_calendar_oauth}},cb);assert.ok(cb.url.endsWith('tasks=connected'));
 assert.equal((await db.query('SELECT * FROM staging_calendar_connections')).rows.length,0);
 const client={id:'c',name:'Synthetic',operationalTasks:[{id:'t',kind:'עדכון מוטבים',due:'2026-10-01',status:'open'}]};
 await db.query('INSERT INTO staging_crm(owner_id,state) VALUES($1,$2)',[owner,JSON.stringify({clients:[client]})]);
 await api.setup(req,response());await api.setup(req,response());assert.equal(lists,1);
 const first=response();await api.sync(req,first);assert.equal(first.statusCode,200,JSON.stringify(first.body));assert.equal(first.body.created,1);await api.sync(req,response());assert.equal(posts,1);
 assert.equal(remote.get('task1').due,'2026-10-01T00:00:00.000Z');
 assert.ok(remote.get('task1').notes.includes('/admin/crm#task=c%3Aoperational%3At'));
 remote.get('task1').status='completed';await api.sync(req,response());assert.equal(remote.get('task1').status,'needsAction');
 client.operationalTasks[0].status='done';await db.query('UPDATE staging_crm SET state=$2 WHERE owner_id=$1',[owner,JSON.stringify({clients:[client]})]);await api.sync(req,response());assert.equal(remote.get('task1').status,'completed');assert.equal(remote.get('foreign').status,'needsAction');
 client.operationalTasks.push({id:'t2',kind:'בדיקת שינוי',due:'2026-10-02'});await db.query('UPDATE staging_crm SET state=$2 WHERE owner_id=$1',[owner,JSON.stringify({clients:[client]})]);lose=true;const lost=response();await api.sync(req,lost);assert.equal(lost.statusCode,400);await api.sync(req,response());assert.equal(posts,2);assert.equal((await db.query('SELECT * FROM staging_tasks_items WHERE remote_id IS NOT NULL')).rows.length,2);
 client.operationalTasks.push({id:'t3',kind:'משימה אחרת',note:'Administrative task',due:'2026-10-03',status:'open',completionPolicy:'manual_internal'});
 await db.query('UPDATE staging_crm SET state=$2 WHERE owner_id=$1',[owner,JSON.stringify({clients:[client]})]);await api.sync(req,response());assert.equal(posts,3);
 remote.get('task3').status='completed';client.operationalTasks[2].note='Changed after export';await db.query('UPDATE staging_crm SET state=$2 WHERE owner_id=$1',[owner,JSON.stringify({clients:[client]})]);const staleCompletion=response();await api.sync(req,staleCompletion);assert.equal(staleCompletion.body.imported,0);assert.equal(remote.get('task3').status,'needsAction');
 remote.get('task3').status='completed';const received=response();await api.sync({...req,body:{revision:1}},received);assert.equal(received.body.imported,1);assert.equal(received.body.revision,2);assert.equal(received.body.completionUpdates[0].taskId,'t3');
 const stored=(await db.query('SELECT state,revision FROM staging_crm')).rows[0];assert.equal(stored.state.clients[0].operationalTasks[2].status,'done');assert.equal(stored.state.clients[0].events.length,1);assert.equal(stored.revision,2);
 const duplicate=response();await api.sync(req,duplicate);assert.equal(duplicate.body.imported,0);assert.equal((await db.query('SELECT state FROM staging_crm')).rows[0].state.clients[0].events.length,1);
 const staleRevision=response();await api.sync({...req,body:{revision:1}},staleRevision);assert.equal(staleRevision.statusCode,409);
 const infoState=structuredClone(stored.state);infoState.clients.push({id:'info-client',name:'Waiting for information',call:'done',products:[],decisions:[]});await db.query('UPDATE staging_crm SET state=$2 WHERE owner_id=$1',[owner,JSON.stringify(infoState)]);await api.sync(req,response());assert.equal(posts,4);remote.get('task4').status='completed';await api.sync(req,response());assert.equal(remote.get('task4').status,'needsAction');assert.deepEqual((await db.query('SELECT state FROM staging_crm')).rows[0].state.clients[1],infoState.clients[1]);
 remote.get('task2').notes='changed';const tampered=response();await api.sync(req,tampered);assert.equal(tampered.statusCode,400);assert.equal(posts,4);
 await db.close();
});
test('external completion cannot overwrite in-progress drafts or close protected checks',()=>{
 const task={id:'a',kind:'משימה אחרת',note:'Original',due:'2026-10-01',status:'open',completionPolicy:'manual_internal'},state={selected:'c',clients:[{id:'c',events:[],operationalTasks:[task],call:'unsaved notes'}]};
 const update={clientId:'c',taskId:'a',previousVersion:taskVersion(task),completedAt:'2026-09-30T10:00:00Z',remoteId:'remote',auditId:'audit'};
 const result=applyTaskCompletions(state,[update]);assert.equal(result.clients[0].operationalTasks[0].status,'done');assert.equal(result.clients[0].call,'unsaved notes');assert.equal(result.selected,'c');assert.equal(applyTaskCompletions(result,[update]).clients[0].events.length,1);
 const changed={...state,clients:[{...state.clients[0],operationalTasks:[{...task,note:'Editing now'}]}]};assert.equal(applyTaskCompletions(changed,[update]).clients[0].operationalTasks[0].status,'open');
 for(const patch of [{kind:'עדכון מוטבים'},{kind:'תביעה'},{completionPolicy:'crm_only'},{requiresEvidence:true},{financial:true},{protected:true},{decisionId:'d'}])assert.equal(externalTaskCompletionAllowed({...task,...patch}),false);
 const waiting={clients:[{id:'i',name:'Info',call:'done',products:[],decisions:[],operationalTasks:[],events:[]}]};assert.equal(operationalProjection(waiting).some(t=>t.key==='i:info'),true);assert.deepEqual(applyTaskCompletions(waiting,[{clientId:'i',taskId:'info',previousVersion:'',completedAt:update.completedAt}]),waiting);
});
