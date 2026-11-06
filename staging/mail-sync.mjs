// Staging-only read access. No send, product update or completion side effects.
import {randomUUID} from 'node:crypto';
import {calendarConfig} from './calendar.mjs';
import {seal,unseal,exchangeToken,gmailGet,normalizeMessage,nationalIds} from '../backend/src/services/gmail.js';
export const READ_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
export const MAILBOXES=['david@davit-fin.co.il','daviddavit55@gmail.com'];
export const syncSchema=`CREATE TABLE IF NOT EXISTS staging_read_connections(owner_id uuid NOT NULL REFERENCES users(id),email text NOT NULL,token text NOT NULL,last_sync timestamptz,next_sync timestamptz NOT NULL DEFAULT now(),cursor text,query text,error text,PRIMARY KEY(owner_id,email));
CREATE TABLE IF NOT EXISTS staging_read_messages(owner_id uuid NOT NULL REFERENCES users(id),id uuid NOT NULL,mailbox text NOT NULL,message_id text NOT NULL,client_id text,candidates jsonb NOT NULL,metadata jsonb NOT NULL,raw bytea NOT NULL,pdfs jsonb NOT NULL DEFAULT '[]',created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(owner_id,id),UNIQUE(owner_id,mailbox,message_id));`;
export function searchQuery(clients){
 const terms=[...new Set(clients.flatMap(c=>[c.identity,c.email,c.name]).filter(v=>typeof v==='string'&&v.trim().length>2&&!MAILBOXES.includes(v.toLowerCase())).map(v=>'"'+v.replace(/["\\{}]/g,' ').trim()+'"'))];
 return terms.length?'{'+terms.join(' ')+'} -in:trash -in:spam':null;
}
export function matchMessage(metadata,clients){
 if(metadata.bulk||metadata.promotional||/(?:דוח|דו״ח|דוחות|דיווח)\s*(?:יומי|יומיים)|daily\s+report/i.test(metadata.subject))return {skip:true};
 // National ID or exact correspondent only. Names are review candidates, not identity proof.
 const text=[metadata.subject,metadata.from,metadata.to,metadata.cc].join(' ');
 const ids=clients.filter(c=>/^\d{5,9}$/.test(c.identity||'')&&new RegExp('(^|\\D)'+c.identity+'(?!\\d)').test(text));
 const bodyIds=clients.filter(c=>metadata.bodyScan?.ids?.includes(c.identity));
 const addresses=(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).map(x=>x.toLowerCase());
 const strong=clients.filter(c=>ids.includes(c)||bodyIds.includes(c)||(c.email&&!MAILBOXES.includes(c.email.toLowerCase())&&addresses.includes(c.email.toLowerCase())));
 const candidates=[...new Set([...strong.map(c=>c.id),...clients.filter(c=>c.name&&text.includes(c.name)).map(c=>c.id)])];
 const allIds=new Set([...nationalIds(text),...(metadata.bodyScan?.ids||[])]);
 return {clientId:strong.length===1&&allIds.size<=1&&metadata.bodyScan?.status!=='partial'&&candidates.every(id=>id===strong[0].id)?strong[0].id:null,candidates};
}
export async function saveReadConnection(pool,owner,email,token,cfg){
 await pool.query('INSERT INTO staging_read_connections(owner_id,email,token) VALUES($1,$2,$3) ON CONFLICT(owner_id,email) DO UPDATE SET token=EXCLUDED.token,error=NULL,next_sync=now()', [owner,email,seal({refresh_token:token.refresh_token},cfg.key,'staging-read:'+owner+':'+email)]);
}
export function createMailSync({pool,env=process.env,request=fetch,afterSync=async()=>{}}){
 const running=new Set();
 async function run(owner){
  const cfg=calendarConfig(env);if(running.has(owner))return;
  const lock=await pool.connect();running.add(owner);let locked=false;
  try{
   locked=(await lock.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked',['mail-sync:'+owner])).rows[0].locked;if(!locked)return;
   const clients=(await pool.query('SELECT state FROM staging_crm WHERE owner_id=$1',[owner])).rows[0]?.state?.clients||[];
   const query=searchQuery(clients);if(!query)return;
   const connections=(await pool.query('SELECT * FROM staging_read_connections WHERE owner_id=$1',[owner])).rows;
   for(const c of connections){try{
    const saved=unseal(c.token,cfg.key,'staging-read:'+owner+':'+c.email);
    const token=await exchangeToken(cfg,{grant_type:'refresh_token',refresh_token:saved.refresh_token},request);
    let cursor=c.query===query?c.cursor:null;
    // Bounded batch, durable cursor, continuation in one minute. Only complete passes wait 12 hours.
    const page=await gmailGet('messages?'+new URLSearchParams({q:query,maxResults:'25',...(cursor?{pageToken:cursor}:{})}),token.access_token,request);
    for(const ref of page.messages||[]){
     if((await pool.query('SELECT id FROM staging_read_messages WHERE owner_id=$1 AND mailbox=$2 AND message_id=$3',[owner,c.email,ref.id])).rows.length)continue;
     const head=await gmailGet('messages/'+encodeURIComponent(ref.id)+'?format=metadata',token.access_token,request);
     if(matchMessage(normalizeMessage(head).metadata,clients).skip)continue;
     const full=await gmailGet('messages/'+encodeURIComponent(ref.id)+'?format=full',token.access_token,request);
     const normalized=normalizeMessage(full,{readBody:true}),match=matchMessage(normalized.metadata,clients);if(match.skip)continue;
     const raw=await gmailGet('messages/'+encodeURIComponent(ref.id)+'?format=raw',token.access_token,request);
     const bytes=Buffer.from(raw.raw||'','base64url');if(!bytes.length||bytes.length>30*1024*1024)throw Error('size');
     const pdfs=[];let total=0;
     async function parts(part,depth=0){if(!part||depth>15)return;for(const child of part.parts||[])await parts(child,depth+1);
      if(!/\.pdf$/i.test(part.filename||''))return;
      const body=part.body?.data?part.body:part.body?.attachmentId?await gmailGet('messages/'+encodeURIComponent(ref.id)+'/attachments/'+encodeURIComponent(part.body.attachmentId),token.access_token,request):null;
      const data=Buffer.from(body?.data||'','base64url');total+=data.length;if(total>30*1024*1024)throw Error('size');
      if(data.subarray(0,5).toString()==='%PDF-')pdfs.push({name:part.filename,data:data.toString('base64')});
     }
     await parts(full.payload);
     await pool.query('INSERT INTO staging_read_messages(owner_id,id,mailbox,message_id,client_id,candidates,metadata,raw,pdfs) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(owner_id,mailbox,message_id) DO NOTHING',[owner,randomUUID(),c.email,ref.id,match.clientId,JSON.stringify(match.candidates),JSON.stringify({...normalized.metadata,rfcMessageId:full.payload?.headers?.find(h=>h.name.toLowerCase()==='message-id')?.value,at:normalized.at,direction:normalized.direction,threadId:full.threadId}),bytes,JSON.stringify(pdfs)]);
    }
    await pool.query("UPDATE staging_read_connections SET cursor=$3,query=$4,error=NULL,last_sync=now(),next_sync=now()+CASE WHEN $3::text IS NULL THEN interval '12 hours' ELSE interval '1 minute' END WHERE owner_id=$1 AND email=$2",[owner,c.email,page.nextPageToken||null,query]);
   }catch(e){await pool.query("UPDATE staging_read_connections SET error=$3,next_sync=now()+interval '15 minutes' WHERE owner_id=$1 AND email=$2",[owner,c.email,[401,403].includes(e.status)?'נדרש חיבור מחדש או אישור קריאה בגוגל':'הסנכרון לא הושלם; ניסיון חוזר בעוד 15 דקות']);}}
   const automation=await afterSync(owner);
   if(automation?.remaining>0)await pool.query("UPDATE staging_read_connections SET next_sync=LEAST(next_sync,now()+interval '1 minute') WHERE owner_id=$1",[owner]);
  }finally{if(locked)await lock.query('SELECT pg_advisory_unlock(hashtext($1))',['mail-sync:'+owner]);lock.release();running.delete(owner);}
 }
 const wrap=fn=>async(req,res)=>{try{await fn(req,res);}catch{res.status(500).json({error:'פעולת סנכרון המיילים נכשלה. נסה שוב.'});}};
 const status=wrap(async(req,res)=>{const rows=(await pool.query('SELECT email,last_sync,next_sync,cursor,error FROM staging_read_connections WHERE owner_id=$1',[req.user.id])).rows;res.json({accounts:MAILBOXES.map(email=>({email,connected:rows.some(r=>r.email===email),...rows.find(r=>r.email===email)})),running:running.has(req.user.id)});});
 const sync=wrap(async(req,res)=>{const rows=(await pool.query('SELECT email FROM staging_read_connections WHERE owner_id=$1',[req.user.id])).rows;if(!rows.length)return res.status(409).json({error:'יש לחבר לפחות תיבה אחת לקריאה.'});void run(req.user.id).catch(()=>{});res.status(202).json({started:true});});
 const list=wrap(async(req,res)=>{const {rows}=await pool.query("SELECT id,mailbox,message_id,client_id,candidates,metadata,jsonb_array_length(pdfs) AS pdf_count FROM staging_read_messages WHERE owner_id=$1 AND ($2::text IS NULL OR client_id=$2 OR client_id IS NULL) ORDER BY metadata->>'at' DESC LIMIT 500",[req.user.id,req.query.clientId||null]);res.json({rows});});
 const assign=wrap(async(req,res)=>{const clients=(await pool.query('SELECT state FROM staging_crm WHERE owner_id=$1',[req.user.id])).rows[0]?.state?.clients||[];if(!clients.some(c=>c.id===req.body.clientId))return res.sendStatus(400);await pool.query('UPDATE staging_read_messages SET client_id=$3 WHERE owner_id=$1 AND id=$2 AND client_id IS NULL',[req.user.id,req.params.id,req.body.clientId]);res.json({saved:true});});
 const download=wrap(async(req,res)=>{const row=(await pool.query('SELECT raw,pdfs FROM staging_read_messages WHERE owner_id=$1 AND id=$2',[req.user.id,req.params.id])).rows[0];if(!row)return res.sendStatus(404);const index=req.query.pdf;let bytes=row.raw,name='email.eml',mime='message/rfc822';if(index!==undefined){if(!/^\d+$/.test(index)||!row.pdfs[Number(index)])return res.sendStatus(404);const pdf=row.pdfs[Number(index)];bytes=Buffer.from(pdf.data,'base64');name=pdf.name;mime='application/pdf';}res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');res.set('Content-Security-Policy',"default-src 'none'; sandbox");res.set('Content-Type',mime);res.set('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(name));res.send(bytes);});
 function start(){const tick=async()=>{try{const {rows}=await pool.query('SELECT DISTINCT owner_id FROM staging_read_connections WHERE next_sync<=now()');for(const r of rows)await run(r.owner_id);}catch{console.warn('Mail sync tick failed');}};void tick();const timer=setInterval(tick,60000);timer.unref();return timer;}
 return {status,sync,list,assign,download,start,run};
}
