import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import express from 'express';
import jwt from 'jsonwebtoken';
import {PGlite} from '../.release/budget-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import {seal,unseal,normalizeMessage,suggestClients,classifyMessage,scanBody,nationalIds,GMAIL_SCOPE,gmailConfig} from './src/services/gmail.js';
import {createGmailRouter} from './src/routes/gmail.js';

test('encryption authenticated and bound to record',()=>{
 const key=randomBytes(32),encrypted=seal({token:'private'},key,'owner1');
 assert(!encrypted.includes('private'));assert.deepEqual(unseal(encrypted,key,'owner1'),{token:'private'});
 assert.throws(()=>unseal(encrypted,key,'owner2'));assert.throws(()=>unseal(encrypted,randomBytes(32),'owner1'));
});
test('headers only and ambiguous matches remain suggestions',()=>{
 const m=normalizeMessage({id:'a',threadId:'b',internalDate:'1000',labelIds:['SENT'],snippet:'DO NOT SAVE',payload:{body:{data:'DO NOT SAVE'},headers:[{name:'From',value:'Client <a@example.com>'}]}});
 assert.equal(m.direction,'outgoing');assert(!JSON.stringify(m).includes('DO NOT SAVE'));
 assert.equal(suggestClients(m.metadata,[{id:1,email:'a@example.com'},{id:2,email:'A@example.com'}]).length,2);
});
test('configuration fails closed',async()=>{
 await assert.rejects(gmailConfig({GMAIL_ENABLED:'false'}));
 await assert.rejects(gmailConfig({GMAIL_ENABLED:'true',GMAIL_CLIENT_ID:'x',GMAIL_CLIENT_SECRET:'x',GMAIL_ALLOWED_EMAIL:'x',GMAIL_REDIRECT_URI:'http://example.com/api/admin/gmail/callback',GMAIL_FRONTEND_URL:'https://example.com',NODE_ENV:'production'}));
});
test('conservative triage: own emails, ID match, marketing and service exceptions',()=>{
 const clients=[{id:1,name:'Owner',email:'admin@example.com'},{id:2,name:'Client',email:'client@example.com',id_number:'012345674'}];
 const ad={subject:'מבצע השבוע בקרפור',from:'Carrefour <news@example.com>',to:'admin@example.com'};
 assert.equal(suggestClients(ad,clients,['admin@example.com']).length,0);
 assert.equal(classifyMessage(ad).bucket,'hidden');
 const service={...ad,subject:'עדכון הפקדה לעובד',promotional:true,bulk:true};
 assert.equal(classifyMessage(service).bucket,'review');
 const idMail={...ad,subject:'Fwd: ת.ז. 12345674 מסמכי הצטרפות'};
 const matches=suggestClients(idMail,clients,['admin@example.com']);
 assert.deepEqual(matches.map(c=>c.id),[2]);
 assert.equal(classifyMessage(idMail,matches).bucket,'relevant');
 assert.equal(classifyMessage(ad,[],true).bucket,'relevant');
 assert.equal(classifyMessage(ad,[],false,'review').bucket,'review');
 assert.equal(classifyMessage({subject:'שלום',from:'unknown@example.com'}).bucket,'review');
 assert.equal(classifyMessage({...ad,from:'client@example.com'},suggestClients({...ad,from:'client@example.com'},clients,['admin@example.com'])).bucket,'relevant');
});
test('body detection: bounded MIME, validated IDs, ambiguity and no retained body',()=>{
 const text=(value,mimeType='text/plain')=>({mimeType,body:{data:Buffer.from(value).toString('base64url')}});
 assert.deepEqual(nationalIds('ת״ז 12345674 / 012345674 / 012345678 / 000000000'),['012345674']);
 const scan=scanBody({mimeType:'multipart/mixed',parts:[text('פרטים פרטיים ת״ז: 012345674'),text('<p>ת&quot;ז: <b>012345674</b></p><script>123456782</script>','text/html'),{...text('123456782'),filename:'report.txt'},text('123456782','application/pdf')]});
 assert.deepEqual(scan,{status:'complete',ids:['012345674']});
 const metadata={subject:'מסמך',bodyScan:scan};
 const clients=[{id:1,name:'A',id_number:'012345674'}];
 const suggestions=suggestClients(metadata,clients);assert.equal(suggestions.length,1);assert.match(suggestions[0].reason,/בגוף/);
 assert.equal(classifyMessage(metadata,suggestions).bucket,'relevant');
 assert.equal(classifyMessage({...metadata,bulk:true},[]).bucket,'review');
 const multi={...metadata,bodyScan:scanBody(text('012345674 123456782'))};
 assert.equal(classifyMessage(multi,suggestClients(multi,clients),false,'hidden').bucket,'review');
 assert.equal(classifyMessage({...metadata,subject:'123456782'},suggestions).bucket,'review');
 assert.equal(classifyMessage(metadata,[...suggestions,{id:2}]).bucket,'review');
 assert.equal(scanBody({mimeType:'text/plain',body:{attachmentId:'never-fetch'}}).status,'partial');
 assert.equal(scanBody(text('x'.repeat(1100000))).status,'partial');
 assert.equal(scanBody({...text('123456782'),headers:[{name:'Content-Disposition',value:'attachment'}]}).status,'no_text');
 const normalized=normalizeMessage({id:'x',threadId:'x',internalDate:'1000',payload:text('private prose 012345674')},{readBody:true});
 assert(!JSON.stringify(normalized).includes('private prose'));assert.deepEqual(normalized.metadata.bodyScan.ids,['012345674']);
});
test('local isolated DB and mocked Google: auth, consent, sync, manual link, audit, disconnect',async()=>{
 const admin='00000000-0000-4000-8000-000000000001',customer='00000000-0000-4000-8000-000000000002';
 const db=new PGlite();const realFetch=globalThis.fetch;let server;const saved={...process.env};
 try{
  await db.exec('CREATE TABLE users(id uuid PRIMARY KEY,email text,name text); CREATE TABLE client_profiles(user_id uuid PRIMARY KEY,id_number text);');
  await db.query('INSERT INTO users VALUES($1,$2,$3),($4,$5,$6)',[admin,'admin@example.com','Admin',customer,'client@example.com','Client']);
  await db.query('INSERT INTO client_profiles(user_id) VALUES($1)',[customer]);
  await db.exec(await readFile(new URL('./src/db/gmail.sql',import.meta.url),'utf8'));
  const pool={query:async(sql,args)=>{
   if(sql.includes('pg_try_advisory_lock'))return {rows:[{locked:true}]};
   if(sql.includes('pg_advisory_'))return {rows:[{}]};
   const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows||r.rows.length};
  },connect:async()=>({...pool,release(){}})};
  Object.assign(process.env,{ADMIN_EMAIL:'admin@example.com',JWT_SECRET:'test-jwt',GMAIL_ENABLED:'true',GMAIL_CLIENT_ID:'test-client',GMAIL_CLIENT_SECRET:'test-secret',GMAIL_CREDENTIALS_FILE:'',GMAIL_ALLOWED_EMAIL:'admin@example.com',GMAIL_ENCRYPTION_KEY:randomBytes(32).toString('base64'),GMAIL_REDIRECT_URI:'http://localhost:3001/api/admin/gmail/callback',GMAIL_FRONTEND_URL:'http://localhost:5173',NODE_ENV:'test'});
  process.env.GMAIL_ALLOWED_EMAILS='admin@example.com,second@gmail.com';
  let googleCalls=0,profileEmail='admin@example.com';
  globalThis.fetch=async(url,options)=>{
   if(!String(url).startsWith('https://'))return realFetch(url,options);
   googleCalls++;
   if(String(url).includes('oauth2.googleapis.com/token'))return Response.json({access_token:'test-access',refresh_token:'test-refresh',scope:GMAIL_SCOPE});
   if(String(url).endsWith('/profile'))return Response.json({emailAddress:profileEmail});
   if(String(url).includes('/messages?'))return Response.json({messages:[{id:'a'}]});
   if(String(url).includes('/messages/a?')){assert.equal(new URL(url).searchParams.get('format'),'full');return Response.json({id:'a',threadId:'t',internalDate:'1750000000000',labelIds:['INBOX'],payload:{mimeType:'text/plain',body:{data:Buffer.from('PRIVATE BODY 012345674').toString('base64url')},headers:[{name:'From',value:'client@example.com'},{name:'Subject',value:'Example'}]}});}
   throw new Error('unexpected Google endpoint');
  };
  const app=express();app.use(express.json());app.use('/api/admin/gmail',createGmailRouter(pool));
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const base=`http://127.0.0.1:${server.address().port}/api/admin/gmail`;
  const headers={Authorization:`Bearer ${jwt.sign({id:admin,email:'admin@example.com'},'test-jwt')}`,'Content-Type':'application/json',Origin:'http://localhost:5173'};
  assert.equal((await realFetch(base+'/status')).status,401);
  const other={...headers,Authorization:`Bearer ${jwt.sign({id:customer,email:'client@example.com'},'test-jwt')}`};
  assert.equal((await realFetch(base+'/status',{headers:other})).status,403);
  assert.equal((await realFetch(base+'/connect',{method:'POST',headers:{...headers,Origin:'https://evil.example'}})).status,403);
  const mailboxBody=JSON.stringify({email:'admin@example.com'});
  assert.equal((await realFetch(base+'/connect',{method:'POST',headers,body:JSON.stringify({email:'outsider@gmail.com'})})).status,400);
  const start=await realFetch(base+'/connect',{method:'POST',headers,body:mailboxBody});assert.equal(start.status,200);
  assert.equal(start.headers.get('set-cookie'),null);
  const launch=new URL((await start.json()).url);
  assert.equal(launch.pathname,'/api/admin/gmail/authorize');
  const launchUrl=base+'/authorize'+launch.search;
  const opened=await realFetch(launchUrl,{redirect:'manual'});assert.equal(opened.status,303);
  assert.equal((await realFetch(launchUrl,{redirect:'manual'})).status,400);
  const auth=new URL(opened.headers.get('location')),cookie=opened.headers.get('set-cookie').split(';')[0];
  assert.equal(auth.searchParams.get('access_type'),'offline');assert.equal(auth.searchParams.get('scope'),GMAIL_SCOPE);
  const callback=base+'/callback?state='+auth.searchParams.get('state')+'&code=fake-code';
  assert.equal((await realFetch(callback,{redirect:'manual'})).status,303);assert.equal(googleCalls,0);
  const valid=await realFetch(callback,{headers:{Cookie:cookie},redirect:'manual'});assert(valid.headers.get('location').endsWith('gmail=connected'));
  const replay=await realFetch(callback,{headers:{Cookie:cookie},redirect:'manual'});assert(replay.headers.get('location').endsWith('gmail=failed'));
  const savedToken=(await db.query('SELECT token_cipher FROM gmail_v2_connections')).rows[0].token_cipher;assert(!savedToken.includes('test-refresh'));
  for(let i=0;i<2;i++)assert.equal((await realFetch(base+'/sync',{method:'POST',headers,body:mailboxBody})).status,200);
  assert.equal((await db.query('SELECT * FROM gmail_v2_messages')).rows.length,1);
  let list=await (await realFetch(base+'/messages',{headers})).json();assert.equal(list.messages[0].client_id,null);assert.equal(list.messages[0].suggestions.length,1);
  const link=await realFetch(base+'/messages/a/link',{method:'POST',headers,body:JSON.stringify({clientId:customer,email:'admin@example.com'})});assert.equal(link.status,200);
  assert.equal((await db.query('SELECT * FROM gmail_v2_link_audit')).rows.length,1);
  // Backfill leaves manual assignment, classification and normal import cursor intact.
  await db.query("UPDATE gmail_v2_messages SET body_scan_version=0,review_override='review' WHERE mailbox='admin@example.com'");
  await db.query("UPDATE gmail_v2_connections SET sync_cursor='keep-page',sync_query='keep-query' WHERE email='admin@example.com'");
  let bodyStatus=await (await realFetch(base+'/status',{headers})).json();assert.equal(bodyStatus.accounts[0].connection.pending_body_scan,1);
  const backfill=await realFetch(base+'/sync',{method:'POST',headers,body:JSON.stringify({email:'admin@example.com',scanExisting:true})});assert.equal(backfill.status,200);assert.deepEqual(await backfill.json(),{imported:1,hasMore:false});
  const savedMessage=(await db.query("SELECT * FROM gmail_v2_messages WHERE mailbox='admin@example.com'")).rows[0];
  assert.equal(savedMessage.client_id,customer);assert.equal(savedMessage.review_override,'review');assert.equal(savedMessage.body_scan_version,1);
  assert.equal((await db.query("SELECT sync_cursor FROM gmail_v2_connections WHERE email='admin@example.com'")).rows[0].sync_cursor,'keep-page');
  list=await (await realFetch(base+'/messages',{headers})).json();assert.equal(list.messages[0].bodyScan.idCount,1);assert(!JSON.stringify(list).includes('012345674'));assert(!JSON.stringify(list).includes('PRIVATE BODY'));
  list=await (await realFetch(base+'/messages?clientId='+customer,{headers})).json();assert.equal(list.messages.length,1);
  async function secondConsent(){
   const r=await realFetch(base+'/connect',{method:'POST',headers,body:JSON.stringify({email:'second@gmail.com'})});
   const u=new URL((await r.json()).url);
   const opened=await realFetch(base+'/authorize'+u.search,{redirect:'manual'});
   const auth=new URL(opened.headers.get('location'));
   assert.equal(auth.searchParams.get('login_hint'),'second@gmail.com');
   return realFetch(base+'/callback?state='+auth.searchParams.get('state')+'&code=fake',{headers:{Cookie:opened.headers.get('set-cookie').split(';')[0]},redirect:'manual'});
  }
  // Selecting the first account for a second-account flow must not overwrite either.
  assert((await secondConsent()).headers.get('location').endsWith('gmail=failed'));
  assert.equal((await db.query('SELECT * FROM gmail_v2_connections')).rows.length,1);
  profileEmail='second@gmail.com';
  assert((await secondConsent()).headers.get('location').endsWith('gmail=connected'));
  const status=await (await realFetch(base+'/status',{headers})).json();
  assert.equal(status.accounts.filter(a=>a.connection).length,2);
  assert.equal((await realFetch(base+'/sync',{method:'POST',headers,body:JSON.stringify({email:'second@gmail.com'})})).status,200);
  list=await (await realFetch(base+'/messages',{headers})).json();
  assert.equal(list.messages.length,2); // Same Google message ID, distinct mailboxes.
  assert.equal(list.messages.find(m=>m.mailbox==='second@gmail.com').client_id,null);
  assert.equal(list.messages.find(m=>m.mailbox==='admin@example.com').client_id,customer);
  assert.equal((await realFetch(base+'/disconnect',{method:'POST',headers,body:mailboxBody})).status,200);
  assert.deepEqual((await db.query('SELECT email FROM gmail_v2_connections')).rows,[{email:'second@gmail.com'}]);
  assert.equal((await db.query('SELECT * FROM gmail_v2_messages')).rows.length,2);
  for(let i=0;i<65;i++){
   const messageId=`ad-${i}`;
   const cipher=seal({subject:'מבצע קרפור',from:'Carrefour <news@example.com>',to:'admin@example.com',cc:''},Buffer.from(process.env.GMAIL_ENCRYPTION_KEY,'base64'),`message:${admin}:admin@example.com:${messageId}`);
   await db.query("INSERT INTO gmail_v2_messages(owner_id,mailbox,message_id,thread_id,metadata_cipher,message_at,direction) VALUES($1,'admin@example.com',$2,$2,$3,NOW(),'incoming')",[admin,messageId,cipher]);
  }
  list=await (await realFetch(base+'/messages',{headers})).json();assert.equal(list.messages.length,2);assert.equal(list.hasMore,false);
  const hidden=await (await realFetch(base+'/messages?view=hidden',{headers})).json();assert.equal(hidden.messages.length,50);assert.equal(hidden.hasMore,true);
  const hiddenNext=await (await realFetch(base+'/messages?view=hidden&offset=50',{headers})).json();assert.equal(hiddenNext.messages.length,15);assert.equal(hiddenNext.hasMore,false);
  const restoreBody=JSON.stringify({email:'admin@example.com',bucket:'review'});
  assert.equal((await realFetch(base+'/messages/ad-0/triage',{method:'POST',headers:other,body:restoreBody})).status,403);
  assert.equal((await realFetch(base+'/messages/ad-0/triage',{method:'POST',headers,body:restoreBody})).status,200);
  list=await (await realFetch(base+'/messages?view=review',{headers})).json();assert.equal(list.messages.length,1);assert.equal(list.messages[0].message_id,'ad-0');
  // A later import updates headers but must preserve the user's classification.
  assert.equal((await db.query("SELECT review_override FROM gmail_v2_messages WHERE message_id='ad-0'")).rows[0].review_override,'review');
 }finally{
  globalThis.fetch=realFetch;for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);
  if(server)await new Promise(resolve=>server.close(resolve));await db.close();
 }
});
