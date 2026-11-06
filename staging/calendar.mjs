// Staging-only Calendar integration. No Gmail scopes, attendees or production data.
import {createHash} from 'node:crypto';
import {appointmentName} from '../.local-preview/appointment-names.js';
import {READ_SCOPE,MAILBOXES,saveReadConnection} from './mail-sync.mjs';
import {appointmentSyncVersion} from '../.local-preview/appointment-edit.js';
import {seal,unseal,nonce,digest,exchangeToken} from '../backend/src/services/gmail.js';
export const SCOPE='https://www.googleapis.com/auth/calendar.app.created';
const EMAIL='daviddavit55@gmail.com';
const COOKIE='nw_calendar_oauth';
const TASKS_SCOPE='https://www.googleapis.com/auth/tasks';
export const schema=`CREATE TABLE IF NOT EXISTS staging_calendar_connections(owner_id uuid PRIMARY KEY REFERENCES users(id),email text NOT NULL,token text NOT NULL,calendar_id text,creating boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS staging_calendar_oauth(state text PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id),browser text NOT NULL,verifier text NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS staging_calendar_events(owner_id uuid NOT NULL REFERENCES users(id),appointment_key text NOT NULL,event_id text NOT NULL,event_url text NOT NULL,synced_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(owner_id,appointment_key));
ALTER TABLE staging_calendar_events ADD COLUMN IF NOT EXISTS source_version text;
ALTER TABLE staging_calendar_events ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'active';`;
export const oauthPurposeSchema="ALTER TABLE staging_calendar_oauth ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'calendar'";
export function calendarConfig(env){
 if(env.APP_ENV!=='staging'||env.PILOT_CALENDAR_ENABLED!=='true')throw Error('disabled');
 const key=Buffer.from(env.PILOT_MAIL_ENCRYPTION_KEY||'','base64');
 const redirect=env.PILOT_MAIL_REDIRECT_URI;
 if(key.length!==32||!env.PILOT_MAIL_CLIENT_ID||!env.PILOT_MAIL_CLIENT_SECRET||redirect!=='https://networth-staging-staging.up.railway.app/api/staging/mail/callback')throw Error('configuration');
 return {key,redirect,origin:new URL(redirect).origin,client_id:env.PILOT_MAIL_CLIENT_ID,client_secret:env.PILOT_MAIL_CLIENT_SECRET};
}
// Resolve wall time explicitly in Israel, rejecting skipped/ambiguous DST times.
export function israelTime(value){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::00)?$/.test(value))throw Error('appointment_time');
 const wall=value.slice(0,16),neutral=Date.parse(wall+':00Z');
 const format=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const matches=[2,3].map(h=>neutral-h*3600000).filter(t=>Number.isFinite(t)&&format.format(t).replace(' ','T')===wall);
 if(matches.length!==1)throw Error('appointment_time');return matches[0];
}
export function eventData(owner,client,appointment){
 if(!client?.id||!appointment?.id||appointment.done||appointment.cancelled)throw Error('appointment_missing');
 const start=israelTime(appointment.when),key=JSON.stringify([client.id,appointment.id]);
 return {key,body:{id:digest(JSON.stringify([owner,client.id,appointment.id])),summary:`[NETWORTH בדיקה] ${String(client.name||'לקוח').slice(0,80)} · ${String(appointmentName(appointment.title)||'פגישה').slice(0,80)}`,description:`פגישת בדיקה מ-NETWORTH. אופן הפגישה: ${String(appointment.mode||'לא צוין').slice(0,30)}. משך: 30 דקות. ללא זימון משתתפים.`,start:{dateTime:new Date(start).toISOString(),timeZone:'Asia/Jerusalem'},end:{dateTime:new Date(start+1800000).toISOString(),timeZone:'Asia/Jerusalem'},extendedProperties:{private:{networthStaging:digest(owner+key)}}}};
}
export function createCalendar({pool,env=process.env,request=fetch}){
 const config=()=>calendarConfig(env);
 const tokenContext=id=>'staging-calendar:'+id;
 async function google(url,token,options={}){const r=await request(url,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(20000)});if(!r.ok){const e=Error('google');e.status=r.status;throw e;}return r.status===204?{}:r.json();}
 async function connection(owner,db=pool){const row=(await db.query('SELECT * FROM staging_calendar_connections WHERE owner_id=$1',[owner])).rows[0];if(!row)throw Error('not_connected');const c=config(),saved=unseal(row.token,c.key,tokenContext(owner));const t=await exchangeToken(c,{grant_type:'refresh_token',refresh_token:saved.refresh_token},request);return {...row,access:t.access_token};}
 const wrap=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){const message=e.message==='appointment_time'?'מועד הפגישה לא תקין או חל בשעת מעבר שעון. בחר מועד אחר.':e.message==='not_connected'?'חבר קודם את היומן האישי.':e.message==='appointment_missing'?'הפגישה לא נמצאה או כבר הסתיימה.':e.status===403?'גוגל חסם את הפעולה. ודא ש-Google Calendar API פעיל ושהרשאת היומן אושרה.':'פעולת היומן לא הושלמה. אפשר לנסות שוב; לא ייווצר אירוע כפול.';res.status(400).json({error:message});}};
 const guard=(req,res,next)=>{try{const c=config();if(req.method!=='GET'&&req.headers.origin!==c.origin)return res.sendStatus(403);next();}catch{res.status(503).json({error:'חיבור היומן טרם הוגדר בשרת.'});}};
 const status=wrap(async(req,res)=>{config();const row=(await pool.query('SELECT email,calendar_id,creating FROM staging_calendar_connections WHERE owner_id=$1',[req.user.id])).rows[0];const events=(await pool.query('SELECT appointment_key,event_url,synced_at,source_version,sync_status FROM staging_calendar_events WHERE owner_id=$1',[req.user.id])).rows;res.json({connected:!!row,email:row?.email||EMAIL,ready:!!row?.calendar_id,uncertain:!!row?.creating,events});});
 const connectFor=purpose=>wrap(async(req,res)=>{const c=config(),state=nonce(),browser=nonce(),verifier=nonce();await pool.query('DELETE FROM staging_calendar_oauth WHERE expires_at<now() OR owner_id=$1',[req.user.id]);await pool.query('INSERT INTO staging_calendar_oauth(state,owner_id,browser,verifier,expires_at,purpose) VALUES($1,$2,$3,$4,now()+interval \'10 minutes\',$5)',[digest(state),req.user.id,digest(browser),seal(verifier,c.key,'calendar-oauth'),purpose]);res.cookie(COOKIE,browser,{httpOnly:true,secure:true,sameSite:'lax',maxAge:600000,path:'/api/staging/mail/callback'});const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:c.client_id,redirect_uri:c.redirect,response_type:'code',scope:(purpose.startsWith('read-')?READ_SCOPE:purpose==='mail'?'https://www.googleapis.com/auth/gmail.send':purpose==='tasks'?TASKS_SCOPE:SCOPE)+' https://www.googleapis.com/auth/userinfo.email',state,access_type:'offline',prompt:'consent select_account',login_hint:purpose==='read-business'||purpose==='mail'?MAILBOXES[0]:EMAIL,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();res.json({url:url.href});});
 const connect=connectFor('calendar'),tasksConnect=connectFor('tasks'),mailConnect=connectFor('mail'),readBusinessConnect=connectFor('read-business'),readPersonalConnect=connectFor('read-personal');
 const callback=async(req,res)=>{let purpose='calendar';res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');try{const c=config(),state=typeof req.query.state==='string'?req.query.state:'',browser=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';const row=(await pool.query('DELETE FROM staging_calendar_oauth WHERE state=$1 AND browser=$2 AND expires_at>now() RETURNING *',[digest(state),digest(browser)])).rows[0];res.clearCookie(COOKIE,{path:'/api/staging/mail/callback',secure:true,httpOnly:true,sameSite:'lax'});if(!row||typeof req.query.code!=='string')throw Error('oauth');purpose=row.purpose;const t=await exchangeToken(c,{grant_type:'authorization_code',code:req.query.code,redirect_uri:c.redirect,code_verifier:unseal(row.verifier,c.key,'calendar-oauth')},request);if(!t.refresh_token||!t.scope?.split(' ').includes(purpose.startsWith('read-')?READ_SCOPE:purpose==='mail'?'https://www.googleapis.com/auth/gmail.send':purpose==='tasks'?TASKS_SCOPE:SCOPE))throw Error('scope');const user=await google('https://www.googleapis.com/oauth2/v2/userinfo',t.access_token);if(user.email?.toLowerCase()!==(purpose==='mail'||purpose==='read-business'?MAILBOXES[0]:EMAIL)||user.verified_email!==true)throw Error('account');if(purpose.startsWith('read-')){await saveReadConnection(pool,row.owner_id,user.email.toLowerCase(),t,c);return res.redirect('/admin/crm?read=connected');}if(purpose==='mail'){await pool.query('INSERT INTO staging_mail_connections(owner_id,token) VALUES($1,$2) ON CONFLICT(owner_id) DO UPDATE SET token=EXCLUDED.token',[row.owner_id,seal({refresh_token:t.refresh_token},c.key,'staging-mail:'+row.owner_id)]);return res.redirect('/admin/crm?mail=connected');}if(purpose==='tasks'){await pool.query('INSERT INTO staging_tasks_connections(owner_id,token) VALUES($1,$2) ON CONFLICT(owner_id) DO UPDATE SET token=EXCLUDED.token',[row.owner_id,seal({refresh_token:t.refresh_token},c.key,'staging-tasks:'+row.owner_id)]);return res.redirect('/admin/crm?tasks=connected');}await pool.query('INSERT INTO staging_calendar_connections(owner_id,email,token) VALUES($1,$2,$3) ON CONFLICT(owner_id) DO UPDATE SET token=EXCLUDED.token',[row.owner_id,EMAIL,seal({refresh_token:t.refresh_token},c.key,tokenContext(row.owner_id))]);res.redirect('/admin/crm?calendar=connected');}catch{res.redirect('/admin/crm?'+(purpose.startsWith('read-')?'read':['tasks','mail'].includes(purpose)?purpose:'calendar')+'=failed');}};
 const setup=wrap(async(req,res)=>{const row=await connection(req.user.id);if(row.calendar_id)return res.json({ready:true});const lock=await pool.query('UPDATE staging_calendar_connections SET creating=true WHERE owner_id=$1 AND calendar_id IS NULL AND creating=false RETURNING owner_id',[req.user.id]);if(!lock.rows.length)return res.status(409).json({error:'יצירת היומן כבר החלה. אם התוצאה לא ברורה, יש לבדוק בגוגל לפני יצירה נוספת.'});let calendar;try{calendar=await google('https://www.googleapis.com/calendar/v3/calendars',row.access,{method:'POST',body:JSON.stringify({summary:'NETWORTH בדיקות',timeZone:'Asia/Jerusalem',description:'יומן בדיקות נפרד של NETWORTH; ללא הזמנות למשתתפים.'})});}catch(e){if([400,401,403,404,429].includes(e.status))await pool.query('UPDATE staging_calendar_connections SET creating=false WHERE owner_id=$1',[req.user.id]);throw e;}await pool.query('UPDATE staging_calendar_connections SET calendar_id=$2,creating=false WHERE owner_id=$1',[req.user.id,calendar.id]);res.json({ready:true});});
 const sync=wrap(async(req,res)=>{
  const owner=req.user.id,db=req.calendarDb||pool,row=await connection(owner,db);
  if(!row.calendar_id)throw Error('not_connected');
  const record=(await db.query('SELECT state,revision FROM staging_crm WHERE owner_id=$1',[owner])).rows[0];
  const client=record?.state?.clients?.find(x=>x.id===req.body.clientId),appointment=client?.appointments?.find(x=>x.id===req.body.appointmentId);
  if(!client||!appointment||appointment.done)throw Error('appointment_missing');
  const version=appointmentSyncVersion(client,appointment),key=JSON.stringify([client.id,appointment.id]),id=digest(JSON.stringify([owner,client.id,appointment.id]));
  if(req.body.expectedVersion!==undefined&&req.body.expectedVersion!==version)return res.status(409).json({error:'הפגישה השתנתה מאז הבקשה. יש לסנכרן את הגרסה העדכנית.'});
  const mapping=(await db.query('SELECT * FROM staging_calendar_events WHERE owner_id=$1 AND appointment_key=$2',[owner,key])).rows[0];
  const base='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(row.calendar_id)+'/events',url=base+'/'+encodeURIComponent(id),marker=digest(owner+key);
  let remote;
  try{remote=await google(url,row.access);}catch(e){if(![404,410].includes(e.status))throw e;}
  if(remote&&remote.status!=='cancelled'&&remote.extendedProperties?.private?.networthStaging!==marker)throw Error('event_conflict');
  if(appointment.cancelled){
   if(remote&&remote.status!=='cancelled')await google(url+'?sendUpdates=none',row.access,{method:'DELETE',headers:remote.etag?{'If-Match':remote.etag}:{}});
   await db.query("INSERT INTO staging_calendar_events(owner_id,appointment_key,event_id,event_url,source_version,sync_status) VALUES($1,$2,$3,$4,$5,'cancelled') ON CONFLICT(owner_id,appointment_key) DO UPDATE SET event_url=EXCLUDED.event_url,source_version=EXCLUDED.source_version,sync_status='cancelled',synced_at=now()",[owner,key,id,remote?.htmlLink||mapping?.event_url||'',version]);
   return res.json({cancelled:true,sourceVersion:version,revision:record.revision});
  }
  if(remote?.status==='cancelled'||mapping?.sync_status==='cancelled')throw Error('event_conflict');
  const {body}=eventData(owner,client,appointment);
  if(!remote){
   // A previously linked event disappearing is not permission to create another one.
   if(mapping)throw Error('event_conflict');
   try{remote=await google(base+'?sendUpdates=none',row.access,{method:'POST',body:JSON.stringify(body)});}catch(e){if(e.status!==409)throw e;remote=await google(url,row.access);}
  }
  if(remote.status==='cancelled'||remote.extendedProperties?.private?.networthStaging!==marker)throw Error('event_conflict');
  if(remote.summary!==body.summary||remote.description!==body.description||Date.parse(remote.start?.dateTime)!==Date.parse(body.start.dateTime)||Date.parse(remote.end?.dateTime)!==Date.parse(body.end.dateTime)){
   const {id:ignored,...patch}=body;
   remote=await google(url+'?sendUpdates=none',row.access,{method:'PATCH',body:JSON.stringify(patch),headers:remote.etag?{'If-Match':remote.etag}:{}});
  }
  if(!remote.htmlLink||!/^https:\/\/(?:calendar\.google\.com|www\.google\.com)\/calendar\/event\?/.test(remote.htmlLink))throw Error('event_link');
  await db.query("INSERT INTO staging_calendar_events(owner_id,appointment_key,event_id,event_url,source_version,sync_status) VALUES($1,$2,$3,$4,$5,'active') ON CONFLICT(owner_id,appointment_key) DO UPDATE SET event_url=EXCLUDED.event_url,source_version=EXCLUDED.source_version,sync_status='active',synced_at=now()",[owner,key,id,remote.htmlLink,version]);
  res.json({url:remote.htmlLink,sourceVersion:version,revision:record.revision});
 });
 const resetPreview=wrap(async(req,res)=>{
  const owner=req.user.id,row=await connection(owner);
  const events=(await pool.query('SELECT appointment_key,event_id FROM staging_calendar_events WHERE owner_id=$1 ORDER BY event_id',[owner])).rows;
  const snapshot=[];
  for(const e of events){let event;try{event=await google('https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(row.calendar_id)+'/events/'+encodeURIComponent(e.event_id),row.access);}catch(err){if(![404,410].includes(err.status))throw err;event={id:e.event_id,status:'cancelled'};}
   if(event.status!=='cancelled'&&event.extendedProperties?.private?.networthStaging!==digest(owner+e.appointment_key))throw Error('event_conflict');snapshot.push({...e,event});}
  res.json({events:snapshot,eventIds:events.map(e=>e.event_id)});
 });
 const reset=wrap(async(req,res)=>{
  const owner=req.user.id,{revision,eventIds,confirmation}=req.body;
  if(confirmation!=='RESET_STAGING_LEADS_AND_OWN_EVENTS'||!Number.isInteger(revision)||!Array.isArray(eventIds))return res.sendStatus(400);
  const db=await pool.connect();let releaseError;try{
   await db.query('BEGIN');
   const acquired=(await db.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired',[owner])).rows[0]?.acquired===true;
   if(!acquired){await db.query('ROLLBACK');return res.status(503).json({code:'sync_busy',retryable:true,error:'סנכרון או שמירה אחרים מתבצעים כרגע. האיפוס לא בוצע; נסה שוב בעוד רגע.'});}
   const record=(await db.query('SELECT revision,state FROM staging_crm WHERE owner_id=$1 FOR UPDATE',[owner])).rows[0];
   const events=(await db.query('SELECT appointment_key,event_id FROM staging_calendar_events WHERE owner_id=$1 ORDER BY event_id',[owner])).rows;
   if(record?.revision!==revision||JSON.stringify(events.map(e=>e.event_id))!==JSON.stringify([...eventIds].sort())){await db.query('ROLLBACK');return res.status(409).json({error:'הנתונים השתנו מאז הגיבוי. האיפוס לא בוצע.'});}
   const row=await connection(owner,db);let removed=0;
   for(const e of events){const url='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(row.calendar_id)+'/events/'+encodeURIComponent(e.event_id);let event;try{event=await google(url,row.access);}catch(err){if([404,410].includes(err.status))continue;throw err;}
    if(event.status==='cancelled')continue;
    if(event.extendedProperties?.private?.networthStaging!==digest(owner+e.appointment_key))throw Error('event_conflict');
    const r=await request(url+'?sendUpdates=none',{method:'DELETE',headers:{Authorization:'Bearer '+row.access},signal:AbortSignal.timeout(20000)});
    if(!r.ok&&![404,410].includes(r.status))throw Error('delete_failed');removed++;
   }
   const state={...record.state,clients:[],deletedClients:[],selected:null};
   await db.query('UPDATE staging_crm SET state=$2::jsonb,revision=revision+1 WHERE owner_id=$1',[owner,JSON.stringify(state)]);
   await db.query('DELETE FROM staging_calendar_events WHERE owner_id=$1',[owner]);
   await db.query('COMMIT');res.json({removedEvents:removed,removedLeads:record.state.clients?.length||0,removedArchivedLeads:record.state.deletedClients?.length||0,calendarConnectionPreserved:true});
  }catch(e){try{await db.query('ROLLBACK');}catch(rollbackError){releaseError=rollbackError;}throw e;}finally{db.release(releaseError);}
 });
 // Serialize calendar changes against reset, including requests already in flight.
 const lockedSync=async(req,res)=>{let db,releaseError;try{
  db=await pool.connect();await db.query('BEGIN');
  // Fail fast instead of filling the shared pool with waiters behind slow Google calls.
  const acquired=(await db.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired',[req.user.id])).rows[0]?.acquired===true;
  if(!acquired){await db.query('ROLLBACK');return res.status(503).json({code:'sync_busy',retryable:true,error:'סנכרון או שמירה אחרים מתבצעים כרגע. הפגישה שמורה ב-CRM; נסה לסנכרן שוב בעוד רגע.'});}
  // Never acknowledge a mapping before its transaction is durable.
  const buffered={code:200,status(n){this.code=n;return this;},json(body){this.body=body;return this;}};
  await sync({...req,calendarDb:db},buffered);
  await db.query(buffered.code>=400?'ROLLBACK':'COMMIT');
  res.status(buffered.code).json(buffered.body);
 }catch{
  if(db)try{await db.query('ROLLBACK');}catch(rollbackError){releaseError=rollbackError;}
  if(!res.headersSent)res.status(500).json({error:'פעולת היומן לא הושלמה.'});
 }finally{db?.release(releaseError);}};
 return {guard,status,connect,tasksConnect,mailConnect,readBusinessConnect,readPersonalConnect,callback,setup,sync:lockedSync,resetPreview,reset};
}
