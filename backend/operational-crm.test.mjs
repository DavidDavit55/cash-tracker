import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createOperationalCrm,operationalCrmSchema} from './src/routes/operationalCrm.js';
import {localDatabase} from './budget-test-db.mjs';
test('production core defaults off, permits only configured DB owner, retains state and rejects stale writes',async()=>{
 const {db,pool:base}=await localDatabase();const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 await db.exec(operationalCrmSchema);await db.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,'test-only')",[owner,'owner@example.test','Test']);
 const state={clients:[{id:'client',history:[{old:true}],unknownFutureField:{preserved:true}}],selected:'client'};
 await db.query('INSERT INTO operational_crm VALUES($1,7,$2)',[owner,JSON.stringify(state)]);
 // PGlite has no cross-process advisory locks; all calls in this test are serial.
 const pool={query:base.query,connect:async()=>({query:async(sql,p)=>sql.includes('pg_advisory_xact_lock')?{rows:[]}:base.query(sql,p),release(){}})};
 const env={CRM_ENABLED:'false',CRM_OWNER_ID:owner,ADMIN_EMAIL:'owner@example.test'};
 const app=express();app.use(express.json());app.use(createOperationalCrm({pool,env,authenticate:(req,res,next)=>{if(!req.headers['x-test-user'])return res.sendStatus(401);req.user={id:req.headers['x-test-user']};next();}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const call=(user,method='GET',body)=>fetch(`http://127.0.0.1:${server.address().port}/state`,{method,headers:{'Content-Type':'application/json',...(user?{'x-test-user':user}:{})},...(body?{body:JSON.stringify(body)}:{})});
 try{
  assert.equal((await call(owner)).status,404);env.CRM_ENABLED='true';assert.equal((await call()).status,401);assert.equal((await call(other)).status,403);
  assert.deepEqual((await (await call(owner)).json()).state,state);
  const ownFile='33333333-3333-4333-8333-333333333333',foreignFile='44444444-4444-4444-8444-444444444444';
  await db.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,'other@example.test','Other','test-only')",[other]);
  for(const [id,user]of [[ownFile,owner],[foreignFile,other]])await db.query('INSERT INTO operational_crm_files(owner_id,id,client_id,name,source,mime,bytes,sha256,size) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[user,id,'client','evidence.html','test','text/html',Buffer.from('<script>alert(1)</script>'),'test',25]);
  const download=(id,user=owner)=>fetch(`http://127.0.0.1:${server.address().port}/files/${id}`,{headers:user?{'x-test-user':user}:{}});
  assert.equal((await download(ownFile,null)).status,401);
  assert.equal((await download(ownFile,other)).status,403);
  assert.equal((await download(foreignFile)).status,404);
  assert.equal((await download('invalid')).status,404);
  const file=await download(ownFile);assert.equal(file.status,200);
  assert.match(file.headers.get('content-type'),/application\/octet-stream/);
  assert.match(file.headers.get('content-disposition'),/^attachment/);
  assert.equal(file.headers.get('cache-control'),'no-store');
  assert.equal(file.headers.get('x-content-type-options'),'nosniff');
  assert.match(file.headers.get('content-security-policy'),/sandbox/);
  assert.equal((await call(owner,'PUT',{revision:6,state})).status,409);
  assert.equal((await call(owner,'PUT',{revision:7,state})).status,200);
  assert.equal((await call(owner,'PUT',{revision:7,state:{clients:[]}})).status,409);
  assert.deepEqual((await (await call(owner)).json()).state,state);
  env.ADMIN_EMAIL='changed@example.test';assert.equal((await call(owner)).status,403);
 }finally{await new Promise(r=>server.close(r));await db.close();}
});
