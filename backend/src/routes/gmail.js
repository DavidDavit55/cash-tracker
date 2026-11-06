import {Router} from 'express';
import pool from '../db/pool.js';
import {authMiddleware} from '../middleware/auth.js';
import {gmailConfig,nonce,digest,seal,unseal,oauthUrl,exchangeToken,gmailGet,GMAIL_SCOPE,normalizeMessage,suggestClients,classifyMessage} from '../services/gmail.js';

export function createGmailRouter(db=pool){
 const router=Router();
 router.use((req,res,next)=>{res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});next();});
 const failure=res=>res.status(503).json({error:'פעולת Gmail לא הושלמה. בדוק את הגדרות החיבור או חבר מחדש.'});
 const admin=async(req,res,next)=>{
  try{
   if(!process.env.ADMIN_EMAIL||req.user.email!==process.env.ADMIN_EMAIL)return res.status(403).json({error:'אין הרשאה'});
   const {rows}=await db.query('SELECT id FROM users WHERE id=$1 AND email=$2',[req.user.id,process.env.ADMIN_EMAIL]);
   if(!rows.length)return res.status(403).json({error:'אין הרשאה'});next();
  }catch{failure(res);}
 };
 // Set the browser binding in a top-level navigation, not a cross-site XHR.
 router.get('/authorize',async(req,res)=>{
  try{
   const c=await gmailConfig(),ticket=req.query.ticket;
   if(typeof ticket!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(ticket))return res.sendStatus(400);
   const {rows:[launch]}=await db.query('DELETE FROM gmail_v2_oauth_launches WHERE ticket_hash=$1 AND expires_at>NOW() RETURNING payload_cipher',[digest(ticket)]);
   if(!launch)return res.status(400).type('text').send('Connection link expired. Start again from NETWORTH.');
   const {state,browser,verifier,email}=unseal(launch.payload_cipher,c.key,`launch:${digest(ticket)}`);
   res.cookie('nw_gmail_browser',browser,{httpOnly:true,secure:c.secure,sameSite:'lax',maxAge:600000,path:'/api/admin/gmail'});
   res.redirect(303,oauthUrl(c,state,verifier,email));
  }catch{failure(res);}
 });
 router.get('/callback',async(req,res)=>{
  let c,client;
  try{
   c=await gmailConfig();
   if(typeof req.query.state!=='string')throw new Error('state');
   const cookie=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('nw_gmail_browser='))?.slice('nw_gmail_browser='.length);
   if(!cookie)throw new Error('browser');
   client=await db.connect();await client.query('BEGIN');
   const args=[digest(req.query.state),digest(cookie)];
   const {rows:[pending]}=await client.query('SELECT owner_id FROM gmail_v2_oauth_states WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>NOW()',args);
   if(!pending)throw new Error('state');
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`gmail:${pending.owner_id}`]);
   const {rows:[state]}=await client.query('DELETE FROM gmail_v2_oauth_states WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>NOW() RETURNING *',args);
   if(!state)throw new Error('state');
   res.clearCookie('nw_gmail_browser',{path:'/api/admin/gmail',httpOnly:true,sameSite:'lax',secure:c.secure});
   const {rows:owner}=await client.query('SELECT id FROM users WHERE id=$1 AND email=$2',[state.owner_id,process.env.ADMIN_EMAIL]);
   if(!owner.length||req.query.error||typeof req.query.code!=='string')throw new Error('denied');
   const tokens=await exchangeToken(c,{code:req.query.code,code_verifier:unseal(state.verifier_cipher,c.key,`state:${state.owner_id}`),redirect_uri:c.redirect,grant_type:'authorization_code'});
   const scopes=tokens.scope?.split(' ')||[];
   if(!tokens.refresh_token||!tokens.access_token||scopes.length!==1||scopes[0]!==GMAIL_SCOPE)throw new Error('scope');
   const profile=await gmailGet('profile',tokens.access_token);
   if(profile.emailAddress?.toLowerCase()!==state.email||!c.allowed.includes(state.email))throw new Error('wrong_account');
   await client.query(`INSERT INTO gmail_v2_connections(owner_id,email,token_cipher) VALUES($1,$2,$3)
    ON CONFLICT(owner_id,email) DO UPDATE SET token_cipher=EXCLUDED.token_cipher,error_code=NULL,connected_at=NOW()`,
    [state.owner_id,state.email,seal({refresh_token:tokens.refresh_token},c.key,`token:${state.owner_id}:${state.email}`)]);
   await client.query('COMMIT');
   res.redirect(303,`${c.front}/admin/mail?gmail=connected`);
  }catch{
   if(client)await client.query('COMMIT').catch(()=>{}); // Consume rejected grants too; SQL failures roll back.
   if(c)res.redirect(303,`${c.front}/admin/mail?gmail=failed`);
   else res.status(503).type('text').send('Gmail configuration is unavailable. Return to NETWORTH.');
  }finally{client?.release();}
 });
 router.use(authMiddleware,admin);
 router.get('/status',async(req,res)=>{
  try{
   let c;try{c=await gmailConfig();}catch{/* Fail closed without exposing configuration. */}
   const {rows}=await db.query(`SELECT email,connected_at,last_sync_at,error_code,sync_cursor IS NOT NULL AS has_more,
    (SELECT COUNT(*)::int FROM gmail_v2_messages m WHERE m.owner_id=c.owner_id AND m.mailbox=c.email AND m.body_scan_version=0) AS pending_body_scan
    FROM gmail_v2_connections c WHERE owner_id=$1`,[req.user.id]);
   res.json({configured:!!c,accounts:(c?.allowed||[]).map(email=>({email,connection:rows.find(r=>r.email===email)||null}))});
  }catch{failure(res);}
 });
 router.post('/connect',async(req,res)=>{
  try{
   const c=await gmailConfig(),state=nonce(),browser=nonce(),verifier=nonce();
   if(req.headers.origin!==c.front)return res.status(403).json({error:'יש להתחבר מתוך NETWORTH בלבד'});
   const email=req.body.email;if(!c.allowed.includes(email))return res.status(400).json({error:'יש לבחור תיבה מורשית'});
   await db.query('DELETE FROM gmail_v2_oauth_states WHERE expires_at<NOW() OR owner_id=$1',[req.user.id]);
   await db.query(`INSERT INTO gmail_v2_oauth_states(state_hash,owner_id,browser_hash,verifier_cipher,email,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '10 minutes')`,[digest(state),req.user.id,digest(browser),seal(verifier,c.key,`state:${req.user.id}`),email]);
   const ticket=nonce();
   await db.query("INSERT INTO gmail_v2_oauth_launches(ticket_hash,state_hash,payload_cipher,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '2 minutes')",[digest(ticket),digest(state),seal({state,browser,verifier,email},c.key,`launch:${digest(ticket)}`)]);
   const launch=new URL('/api/admin/gmail/authorize',c.redirect);launch.searchParams.set('ticket',ticket);
   res.json({url:launch.href});
  }catch{failure(res);}
 });
 router.post('/sync',async(req,res)=>{
  let client,locked=false;const email=req.body.email;
  try{
   const c=await gmailConfig();if(!c.allowed.includes(email))return res.status(400).json({error:'יש לבחור תיבה מורשית'});client=await db.connect();
   const {rows:[lock]}=await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked',[`gmail:${req.user.id}`]);locked=lock.locked;
   if(!locked)return res.status(409).json({error:'סנכרון כבר מתבצע, נסה שוב בעוד רגע.'});
   const {rows:[connection]}=await client.query('SELECT * FROM gmail_v2_connections WHERE owner_id=$1 AND email=$2',[req.user.id,email]);
   if(!connection)return res.status(409).json({error:'יש לחבר את החשבון תחילה'});
   const secret=unseal(connection.token_cipher,c.key,`token:${req.user.id}:${email}`);
   const tokens=await exchangeToken(c,{grant_type:'refresh_token',refresh_token:secret.refresh_token});
   if(!tokens.access_token)throw new Error('token');
   const until=Math.floor(Date.now()/1000),since=until-30*86400;
   const query=connection.sync_query||`after:${since} before:${until} -in:spam -in:trash -in:drafts`;
   const params=new URLSearchParams({q:query,maxResults:'25'});
   if(connection.sync_cursor)params.set('pageToken',connection.sync_cursor);
   const scanExisting=req.body.scanExisting===true;
   const list=scanExisting?{messages:(await client.query('SELECT message_id AS id FROM gmail_v2_messages WHERE owner_id=$1 AND mailbox=$2 AND body_scan_version=0 ORDER BY message_at DESC LIMIT 25',[req.user.id,email])).rows}:await gmailGet(`messages?${params}`,tokens.access_token);
   let imported=0;
   for(const item of list.messages||[]){
    const q=new URLSearchParams({format:'full'});
    let raw;try{raw=await gmailGet(`messages/${encodeURIComponent(item.id)}?${q}`,tokens.access_token);}catch(err){if(err.status===404){
     if(scanExisting)await client.query('UPDATE gmail_v2_messages SET body_scan_version=-1 WHERE owner_id=$1 AND mailbox=$2 AND message_id=$3',[req.user.id,email,item.id]);
     continue;
    }throw err;}
    const m=normalizeMessage(raw,{readBody:true});
    await client.query(`INSERT INTO gmail_v2_messages(owner_id,message_id,thread_id,metadata_cipher,message_at,direction,mailbox,body_scan_version)
     VALUES($1,$2,$3,$4,$5,$6,$7,1) ON CONFLICT(owner_id,mailbox,message_id) DO UPDATE SET metadata_cipher=EXCLUDED.metadata_cipher,direction=EXCLUDED.direction,body_scan_version=1`,
     [req.user.id,m.id,m.threadId,seal(m.metadata,c.key,`message:${req.user.id}:${email}:${m.id}`),m.at,m.direction,email]);imported++;
   }
   if(scanExisting){
    const {rows:[remaining]}=await client.query('SELECT COUNT(*)::int AS count FROM gmail_v2_messages WHERE owner_id=$1 AND mailbox=$2 AND body_scan_version=0',[req.user.id,email]);
    await client.query('UPDATE gmail_v2_connections SET error_code=NULL WHERE owner_id=$1 AND email=$2',[req.user.id,email]);
    return res.json({imported,hasMore:remaining.count>0});
   }
   await client.query(`UPDATE gmail_v2_connections SET sync_cursor=$2,sync_query=$3,error_code=NULL,
    last_sync_at=CASE WHEN $2::text IS NULL THEN NOW() ELSE last_sync_at END WHERE owner_id=$1 AND email=$4`,
    [req.user.id,list.nextPageToken||null,list.nextPageToken?query:null,email]);
   res.json({imported,hasMore:!!list.nextPageToken});
  }catch{
   // Never emit Google responses, message headers, OAuth codes or tokens in logs.
   if(client&&locked)await client.query("UPDATE gmail_v2_connections SET error_code='sync_failed' WHERE owner_id=$1 AND email=$2",[req.user.id,email]).catch(()=>{});
   failure(res);
  }finally{
   if(client){if(locked)await client.query('SELECT pg_advisory_unlock(hashtext($1))',[`gmail:${req.user.id}`]).catch(()=>{});client.release();}
  }
 });
 router.get('/messages',async(req,res)=>{
  try{
   const c=await gmailConfig();
   const offset=Number(req.query.offset||0);if(!Number.isInteger(offset)||offset<0||offset>100000)return res.status(400).json({error:'עמוד לא תקין'});
   const customer=req.query.clientId||null;if(customer&&!/^[0-9a-f-]{36}$/i.test(customer))return res.status(400).json({error:'לקוח לא תקין'});
   const view=req.query.view||'work';if(!['work','relevant','review','hidden','all'].includes(view))return res.status(400).json({error:'סינון לא תקין'});
   const {rows:clients}=await db.query('SELECT u.id,u.name,u.email,cp.id_number FROM users u JOIN client_profiles cp ON cp.user_id=u.id WHERE u.id<>$1 ORDER BY u.name',[req.user.id]);
   const messages=[];let scanned=0,matched=0;
   // Filter before pagination, including previously imported headers. Never change Gmail.
   while(messages.length<51){
    const {rows}=await db.query(`SELECT mailbox,message_id,thread_id,metadata_cipher,message_at,direction,client_id,linked_at,review_override,body_scan_version FROM gmail_v2_messages
     WHERE owner_id=$1 AND ($2::uuid IS NULL OR client_id=$2) ORDER BY message_at DESC,mailbox,message_id DESC LIMIT 250 OFFSET $3`,[req.user.id,customer,scanned]);
    for(const row of rows){
     const {metadata_cipher,review_override,body_scan_version,...safe}=row;
     const metadata=unseal(metadata_cipher,c.key,`message:${req.user.id}:${row.mailbox}:${row.message_id}`);
     const suggestions=suggestClients(metadata,clients,[...c.allowed,process.env.ADMIN_EMAIL]);
     const triage=classifyMessage(metadata,suggestions,!!row.client_id,review_override);
     if(view==='all'||(view==='work'?triage.bucket!=='hidden':triage.bucket===view)){
      const {bodyScan,...headers}=metadata;
      if(matched++>=offset)messages.push({...safe,...headers,bodyScan:{status:body_scan_version===-1?'unavailable':bodyScan?.status||'pending',idCount:bodyScan?.ids?.length||0},suggestions,triage});
      if(messages.length===51)break;
     }
    }
    if(rows.length<250)break;scanned+=rows.length;
   }
   res.json({messages:messages.slice(0,50),clients:clients.map(({id,name})=>({id,name})),hasMore:messages.length>50});
  }catch{failure(res);}
 });
 router.post('/messages/:messageId/triage',async(req,res)=>{
  try{
   const {email,bucket}=req.body;
   if(typeof email!=='string'||!['review','hidden'].includes(bucket))return res.status(400).json({error:'סיווג לא תקין'});
   const {rows}=await db.query('UPDATE gmail_v2_messages SET review_override=$4 WHERE owner_id=$1 AND mailbox=$2 AND message_id=$3 RETURNING message_id',[req.user.id,email,req.params.messageId,bucket]);
   if(!rows.length)return res.status(404).json({error:'מייל לא נמצא'});
   res.json({ok:true});
  }catch{failure(res);}
 });
 router.post('/messages/:messageId/link',async(req,res)=>{
  let client;
  try{
   const id=req.body.clientId;if(id!==null&&(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)))return res.status(400).json({error:'יש לבחור לקוח'});
   client=await db.connect();await client.query('BEGIN');
   if(id){const {rows}=await client.query('SELECT user_id FROM client_profiles WHERE user_id=$1',[id]);if(!rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'לקוח לא נמצא'});}}
   const email=req.body.email;if(typeof email!=='string'||email.length>254){await client.query('ROLLBACK');return res.status(400).json({error:'יש לבחור תיבה'});}
   const {rows:[message]}=await client.query('SELECT client_id FROM gmail_v2_messages WHERE owner_id=$1 AND message_id=$2 AND mailbox=$3 FOR UPDATE',[req.user.id,req.params.messageId,email]);
   if(!message){await client.query('ROLLBACK');return res.status(404).json({error:'מייל לא נמצא'});}
   if(message.client_id!==id){
    await client.query('UPDATE gmail_v2_messages SET client_id=$3,linked_at=NOW() WHERE owner_id=$1 AND message_id=$2 AND mailbox=$4',[req.user.id,req.params.messageId,id,email]);
    await client.query('INSERT INTO gmail_v2_link_audit(owner_id,message_id,previous_client_id,next_client_id,mailbox) VALUES($1,$2,$3,$4,$5)',[req.user.id,req.params.messageId,message.client_id,id,email]);
   }
   await client.query('COMMIT');res.json({ok:true});
  }catch{if(client)await client.query('ROLLBACK').catch(()=>{});failure(res);}finally{client?.release();}
 });
 router.post('/disconnect',async(req,res)=>{
  let client;
  try{
   client=await db.connect();await client.query('BEGIN');
   // Wait for any in-flight sync before deleting access credentials.
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`gmail:${req.user.id}`]);
   const email=req.body.email;if(typeof email!=='string'||email.length>254){await client.query('ROLLBACK');return res.status(400).json({error:'יש לבחור תיבה'});}
   await client.query('DELETE FROM gmail_v2_connections WHERE owner_id=$1 AND email=$2',[req.user.id,email]);
   await client.query('DELETE FROM gmail_v2_oauth_states WHERE owner_id=$1 AND email=$2',[req.user.id,email]);
   await client.query('COMMIT');res.json({ok:true,retainsImportedMessages:true});
  }catch{if(client)await client.query('ROLLBACK').catch(()=>{});failure(res);}finally{client?.release();}
 });
 return router;
}
export default createGmailRouter();
