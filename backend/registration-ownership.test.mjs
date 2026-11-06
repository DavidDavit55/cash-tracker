import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from './src/db/pool.js';
let sends=0;
mock.module('./src/lib/twilioVerify.js',{namedExports:{toE164:v=>v,verifyService:()=>({verifications:{create:async()=>{sends++;}},verificationChecks:{create:async()=>{sends++;return {status:'approved'};}}})}});
const {default:auth}=await import('./src/routes/auth.js');
const {default:phone}=await import('./src/routes/phoneVerify.js');
test('unfinished accounts cannot be claimed, admin registration denied, phone proof bound to account',async()=>{
 process.env.JWT_SECRET='local-regression-secret';process.env.ADMIN_EMAIL='admin@example.test';
 const originalConnect=pool.connect,originalQuery=pool.query;let writes=0;
 const query=async sql=>{if(/UPDATE|INSERT/.test(sql))writes++;if(sql.includes('LEFT JOIN'))return {rows:[{id:'existing',signature_data:null}]};if(sql.startsWith('SELECT phone'))return {rows:[{phone:'0501111111'}]};return {rows:[]};};
 pool.connect=async()=>({query,release(){}});pool.query=query;
 const app=express();app.use(express.json());app.use('/auth',auth);app.use('/phone',phone);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const call=(url,body,token)=>fetch(`http://127.0.0.1:${server.address().port}${url}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
 try{
  const body={email:'customer@example.test',name:'Test',phone:'0501111111'};
  assert.equal((await call('/auth/register',body)).status,409);
  assert.equal((await call('/auth/register',body,jwt.sign({id:'other'},process.env.JWT_SECRET))).status,409);
  assert.equal((await call('/auth/register',{...body,email:'admin@example.test'})).status,403);
  const token=jwt.sign({id:'existing'},process.env.JWT_SECRET);
  for(const url of ['/phone/send','/phone/check'])assert.equal((await call(url,{phone:'0502222222',code:'123456'},token)).status,403);
  assert.equal(writes,0);assert.equal(sends,0);
 }finally{pool.connect=originalConnect;pool.query=originalQuery;await new Promise(r=>server.close(r));}
});
