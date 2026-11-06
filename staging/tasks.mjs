// Isolated pilot: mirror operational CRM work into one dedicated Google Tasks list.
import {calendarConfig} from './calendar.mjs';
import {unseal,digest} from '../backend/src/services/gmail.js';
import {homeTasks,taskLinkHash} from '../.local-preview/workflow-home-model.js';
import {externalTaskCompletionAllowed,taskVersion,applyTaskCompletions} from '../.local-preview/task-sync.js';
import {randomUUID} from 'node:crypto';
export const TASKS_SCOPE='https://www.googleapis.com/auth/tasks';
export async function refreshTasksToken(c,refreshToken,request=fetch){
 if(!refreshToken)throw Error('reauthorize');
 const r=await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.client_id,client_secret:c.client_secret,grant_type:'refresh_token',refresh_token:refreshToken}),signal:AbortSignal.timeout(20000)});
 const body=await r.json();
 if(!r.ok){const e=Error(body.error==='invalid_grant'?'reauthorize':body.error==='invalid_client'?'oauth_configuration':'token_refresh_failed');e.status=r.status;throw e;}
 if(!body.access_token)throw Error('token_refresh_failed');
 return body;
}
export const tasksSchema=`CREATE TABLE IF NOT EXISTS staging_tasks_connections(owner_id uuid PRIMARY KEY REFERENCES users(id),token text NOT NULL,list_id text,creating boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS staging_tasks_items(owner_id uuid NOT NULL REFERENCES users(id),source_key text NOT NULL,remote_id text,phase text NOT NULL DEFAULT 'creating',PRIMARY KEY(owner_id,source_key));
ALTER TABLE staging_tasks_items ADD COLUMN IF NOT EXISTS source_version text;`;
export function operationalProjection(state){return homeTasks(state.clients||[]).filter(t=>t.tab==='ביצוע ומעקב'||t.id===`${t.clientId}:info`).map(t=>({key:t.id,title:(t.clientName+' · '+t.title.replace(/: [\d.,]+ ₪/, '')).slice(0,1024),due:/^\d{4}-\d\d-\d\d$/.test(t.due||'')?t.due+'T00:00:00.000Z':null}));}
export function createTasks({pool,env=process.env,request=fetch}){
 const config=()=>calendarConfig(env),base='https://tasks.googleapis.com/tasks/v1';
 async function google(path,token,options={}){const r=await request(base+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});if(!r.ok){const e=Error('google');e.status=r.status;throw e;}return r.status===204?{}:r.json();}
 async function connection(owner,db=pool){const row=(await db.query('SELECT * FROM staging_tasks_connections WHERE owner_id=$1',[owner])).rows[0];if(!row)throw Error('not_connected');const c=config(),saved=unseal(row.token,c.key,'staging-tasks:'+owner);const t=await refreshTasksToken(c,saved.refresh_token,request);return {...row,access:t.access_token};}
 const wrap=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){res.status(400).json({code:['reauthorize','oauth_configuration','token_refresh_failed','not_connected','uncertain','integrity'].includes(e.message)?e.message:'tasks_sync_failed',error:e.message==='reauthorize'?'הרשאת Google Tasks אינה תקפה עוד. לחץ על חיבור מחדש ל־Google Tasks ואשר גישה בחשבון האישי. הרשימה והקישורים למשימות נשמרו.':e.message==='oauth_configuration'?'הגדרת חיבור Google Tasks אינה תקינה. נדרש תיקון בהגדרות השרת.':e.message==='not_connected'?'יש לאשר קודם את חיבור Google Tasks.':e.message==='uncertain'?'תוצאת היצירה לא ודאית. נעצרנו כדי לא ליצור כפילות; נדרש בירור.':e.message==='integrity'?'המשימה השתנתה בגוגל או נמחקה. נדרש בירור לפני סנכרון נוסף.':e.status===403?'יש להפעיל Google Tasks API ולאשר את הרשאת המשימות בחשבון האישי.':'סנכרון המשימות לא הושלם. הנתונים ב-CRM נשמרו; נסה סנכרון חוזר.'});}};
 const status=wrap(async(req,res)=>{config();const row=(await pool.query('SELECT list_id,creating FROM staging_tasks_connections WHERE owner_id=$1',[req.user.id])).rows[0];res.json({connected:!!row,ready:!!row?.list_id,uncertain:!!row?.creating});});
 const setup=wrap(async(req,res)=>{const row=await connection(req.user.id);if(row.list_id)return res.json({ready:true});const lock=await pool.query('UPDATE staging_tasks_connections SET creating=true WHERE owner_id=$1 AND list_id IS NULL AND creating=false RETURNING owner_id',[req.user.id]);if(!lock.rows.length)throw Error('uncertain');let list;try{list=await google('/users/@me/lists',row.access,{method:'POST',body:JSON.stringify({title:'NETWORTH — תפעול'})});}catch(e){if([400,401,403,404,429].includes(e.status))await pool.query('UPDATE staging_tasks_connections SET creating=false WHERE owner_id=$1',[req.user.id]);throw e;}if(!list.id)throw Error('uncertain');await pool.query('UPDATE staging_tasks_connections SET list_id=$2,creating=false WHERE owner_id=$1',[req.user.id,list.id]);res.json({ready:true});});
 const sync=wrap(async(req,res)=>{
  const owner=req.user.id,lock=await pool.connect();let acquired=false;
  try{
   // Do not occupy pool slots waiting for another sync; its Google calls may be slow.
   acquired=(await lock.query('SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',[owner])).rows[0]?.acquired===true;
   if(!acquired)return res.status(503).json({code:'sync_busy',retryable:true,error:'סנכרון או שמירה אחרים מתבצעים כרגע. הנתונים נשמרו; נסה לסנכרן שוב בעוד רגע.'});
   // Every query under the lock must use this client, never ask the pool for another.
   const row=await connection(owner,lock);if(!row.list_id)throw Error('not_connected');
   const record=(await lock.query('SELECT state,revision FROM staging_crm WHERE owner_id=$1',[owner])).rows[0]||{state:{clients:[]},revision:0};
   if(req.body?.revision!==undefined&&req.body.revision!==record.revision)return res.status(409).json({error:'נתוני התיק השתנו. יש לרענן לפני סנכרון משימות.'});
   let state=record.state,desired=operationalProjection(state);
   const url='/lists/'+encodeURIComponent(row.list_id)+'/tasks';
   const all=[];let pageToken;
   do{const q=new URLSearchParams({maxResults:'100',showCompleted:'true',showHidden:'true',showDeleted:'true',...(pageToken?{pageToken}:{})});const page=await google(url+'?'+q,row.access);all.push(...(page.items||[]));pageToken=page.nextPageToken;}while(pageToken);
   const mappings=(await lock.query('SELECT * FROM staging_tasks_items WHERE owner_id=$1',[owner])).rows;
   const completionUpdates=[];
   // External completion is accepted only for the exact administrative version last exported.
   // Protected product, money, document, information and follow-up checks never enter this branch.
   for(const client of req.body?.exportOnly?[]:state.clients||[])for(const task of client.operationalTasks||[]){
    if(task.status==='done'||!externalTaskCompletionAllowed(task))continue;
    const key=`${client.id}:operational:${task.id}`,mapping=mappings.find(m=>m.source_key===key),remote=all.find(t=>t.id===mapping?.remote_id);
    const marker='NETWORTH-ID:'+digest(owner+key);
    if(remote?.status==='completed'&&!remote.deleted&&remote.notes?.split('\n').includes(marker)&&mapping?.source_version===taskVersion(task))completionUpdates.push({clientId:client.id,taskId:task.id,previousVersion:taskVersion(task),completedAt:new Date().toISOString(),remoteId:remote.id,auditId:randomUUID()});
   }
   let revision=record.revision;
   if(completionUpdates.length){
    state=applyTaskCompletions(state,completionUpdates);
    desired=operationalProjection(state);
   }
   let created=0,updated=0,completed=0;
   for(const task of desired){
    const marker='NETWORTH-ID:'+digest(owner+task.key),mapping=mappings.find(m=>m.source_key===task.key);
    let remote=mapping?.remote_id?all.find(t=>t.id===mapping.remote_id):all.find(t=>t.notes?.split('\n').includes(marker)&&!t.deleted);
    const local=(state.clients||[]).flatMap(c=>(c.operationalTasks||[]).map(t=>({key:`${c.id}:operational:${t.id}`,task:t}))).find(t=>t.key===task.key)?.task;
    const version=local?taskVersion(local):null;
    const payload={title:task.title,notes:(externalTaskCompletionAllowed(local)?'משימה מנהלית שאושרה לסגירה גם בגוגל. השלמה תסונכרן בפתיחת ה-CRM או בסנכרון ידני.':'משימת תפעול מ-NETWORTH. השלמת הטיפול נעשית ב-CRM בלבד; סימון כאן אינו אישור ביצוע.')+'\n'+config().origin+'/admin/crm'+taskLinkHash(task.key)+'\n'+marker,status:'needsAction',due:task.due};
    if(mapping?.remote_id&&(!remote||remote.deleted||!remote.notes?.split('\n').includes(marker)))throw Error('integrity');
    if(!remote){if(mapping)throw Error('uncertain');await lock.query('INSERT INTO staging_tasks_items(owner_id,source_key) VALUES($1,$2)',[owner,task.key]);
     try{remote=await google(url,row.access,{method:'POST',body:JSON.stringify(payload)});}catch(e){if([400,401,403,404,429].includes(e.status))await lock.query('DELETE FROM staging_tasks_items WHERE owner_id=$1 AND source_key=$2 AND remote_id IS NULL',[owner,task.key]);throw e;}created++;
    }else if(remote.title!==payload.title||remote.notes!==payload.notes||remote.status!=='needsAction'||(remote.due?.slice(0,10)||null)!==(task.due?.slice(0,10)||null)){
     await google(url+'/'+encodeURIComponent(remote.id),row.access,{method:'PATCH',body:JSON.stringify(payload)});updated++;
    }
    if(!remote.id)throw Error('uncertain');
    await lock.query("INSERT INTO staging_tasks_items(owner_id,source_key,remote_id,phase,source_version) VALUES($1,$2,$3,'linked',$4) ON CONFLICT(owner_id,source_key) DO UPDATE SET remote_id=EXCLUDED.remote_id,phase='linked',source_version=EXCLUDED.source_version",[owner,task.key,remote.id,version]);
   }
   for(const mapping of mappings.filter(m=>!desired.some(t=>t.key===m.source_key))){
    const marker='NETWORTH-ID:'+digest(owner+mapping.source_key),remote=mapping.remote_id?all.find(t=>t.id===mapping.remote_id):all.find(t=>t.notes?.split('\n').includes(marker)&&!t.deleted);
    if(!mapping.remote_id&&!remote)throw Error('uncertain');
    if(remote&&!remote.deleted&&remote.status!=='completed'){if(!remote.notes?.split('\n').includes(marker))throw Error('integrity');await google(url+'/'+encodeURIComponent(remote.id),row.access,{method:'PATCH',body:JSON.stringify({status:'completed'})});completed++;}
    if(remote?.id&&!mapping.remote_id)await lock.query("UPDATE staging_tasks_items SET remote_id=$3,phase='linked' WHERE owner_id=$1 AND source_key=$2",[owner,mapping.source_key,remote.id]);
   }
   if(completionUpdates.length){
    const saved=await lock.query('UPDATE staging_crm SET state=$3::jsonb,revision=revision+1 WHERE owner_id=$1 AND revision=$2 RETURNING revision',[owner,record.revision,JSON.stringify(state)]);
    if(!saved.rows.length)return res.status(409).json({error:'התיק השתנה. סגירת המשימות מגוגל לא נשמרה; יש לסנכרן שוב.'});
    revision=saved.rows[0].revision;
   }
   res.json({created,updated,completed,completionUpdates,revision,imported:completionUpdates.length,open:desired.length,undated:desired.filter(t=>!t.due).length});
  }finally{
   let unlockError;
   try{if(acquired)await lock.query('SELECT pg_advisory_unlock(hashtext($1))',[owner]);}catch(e){unlockError=e;}
   // A failed unlock must destroy the connection, not leak a pool slot/session lock.
   finally{lock.release(unlockError);}
  }
 });
 return {status,setup,sync};
}
