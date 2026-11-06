import {calendarConfig} from './calendar.mjs';
import {unseal,digest,exchangeToken} from '../backend/src/services/gmail.js';
import {payrollMessage} from './payroll-mail.mjs';
import {deliveryMessage} from './delivery-mail.mjs';
import {summaryMeetingName} from '../.local-preview/appointment-names.js';
export const MAIL_SCOPE='https://www.googleapis.com/auth/gmail.send';
export const SENDER='david@davit-fin.co.il',RECIPIENT='davidsdreams55@gmail.com';
export const mailSchema=`CREATE TABLE IF NOT EXISTS staging_mail_connections(owner_id uuid PRIMARY KEY REFERENCES users(id),token text NOT NULL);
CREATE TABLE IF NOT EXISTS staging_mail_sends(owner_id uuid NOT NULL REFERENCES users(id),send_key text NOT NULL,status text NOT NULL,message_id text,PRIMARY KEY(owner_id,send_key));
ALTER TABLE staging_mail_sends ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE staging_mail_sends ADD COLUMN IF NOT EXISTS raw text;
ALTER TABLE staging_mail_sends ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE staging_mail_sends ADD COLUMN IF NOT EXISTS intended text;
ALTER TABLE staging_mail_sends ADD COLUMN IF NOT EXISTS sent_at timestamptz;`;
export function mime(summary,key,subject='NETWORTH — סיכום פגישה [בדיקת סטייגינג]'){return Buffer.from(['From: '+SENDER,'To: '+RECIPIENT,'Subject: =?UTF-8?B?'+Buffer.from(subject).toString('base64')+'?=','Message-ID: <'+key+'@davit-fin.co.il>','MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',Buffer.from('[סביבת בדיקה — לא נשלח ללקוח]\n\n'+summary).toString('base64').match(/.{1,76}/g).join('\r\n')].join('\r\n')).toString('base64url');}
export function createMail({pool,env=process.env,request=fetch}){
 const wrap=fn=>async(req,res)=>{try{calendarConfig(env);await fn(req,res);}catch{res.status(400).json({error:'השליחה לא אושרה. ודא שחיבור המייל הושלם ושהסיכום נשמר. אם התוצאה לא ודאית לא נשלח שוב אוטומטית.'});}};
 const status=wrap(async(req,res)=>res.json({connected:!!(await pool.query('SELECT owner_id FROM staging_mail_connections WHERE owner_id=$1',[req.user.id])).rows.length,sender:SENDER,recipient:RECIPIENT}));
 const send=wrap(async(req,res)=>{
  const owner=req.user.id,row=(await pool.query('SELECT state,revision FROM staging_crm WHERE owner_id=$1',[owner])).rows[0],client=row?.state?.clients?.find(c=>c.id===req.body.clientId);
  const payroll=req.path?.endsWith('/payroll'),delivery=req.path?.endsWith('/delivery');
  if(!client||row.revision!==req.body.revision)throw Error('stale');
  if(!payroll&&!delivery&&(!client.meetingDone||!client.summary||client.summary!==req.body.summary||client.summary.length>100000))throw Error('stale');
  let payrollBody=req.body;
  if(payroll){payrollBody={...req.body,draft:{...req.body.draft}};for(const key of ['annex','cubes']){const file=payrollBody.draft[key];if(file)payrollBody.draft[key]={...file,serverArchived:false};if(file?.storage==='staging-private'&&file.id){const saved=(await pool.query('SELECT name,mime,bytes FROM staging_crm_files WHERE owner_id=$1 AND client_id=$2 AND id=$3',[owner,client.id,file.id])).rows[0];if(!saved||saved.bytes.length>8000000)throw Error('invalid_attachment');payrollBody.draft[key]={name:saved.name,data:'data:'+saved.mime+';base64,'+saved.bytes.toString('base64'),serverArchived:true};}}}
  const message=payroll?payrollMessage(client,payrollBody):delivery?deliveryMessage(client,req.body):null;
  const key=message?digest(owner+message.key):digest(JSON.stringify([owner,client.id,client.summary,RECIPIENT]));
  const summarySubject='סיכום '+summaryMeetingName(client)+' — '+(client.name||'לקוח')+' [בדיקת סטייגינג]';
  const raw=message?.raw||mime(client.summary,key,summarySubject);
  const prior=(await pool.query('SELECT * FROM staging_mail_sends WHERE owner_id=$1 AND send_key=$2',[owner,key])).rows[0];
  if(prior?.status==='sent')return res.json({sent:true,recipient:RECIPIENT,messageId:prior.message_id,payrollSentAt:prior.sent_at?new Date(prior.sent_at).toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'}):message?.payrollSentAt});
  if(prior)return res.status(409).json({error:'תוצאת השליחה הקודמת עדיין אינה ודאית. בדוק בדואר שנשלח; לא נשלח עותק נוסף.'});
  const connection=(await pool.query('SELECT token FROM staging_mail_connections WHERE owner_id=$1',[owner])).rows[0];if(!connection)throw Error('not_connected');
  const cfg=calendarConfig(env),saved=unseal(connection.token,cfg.key,'staging-mail:'+owner),token=await exchangeToken(cfg,{grant_type:'refresh_token',refresh_token:saved.refresh_token},request);
  const intent=await pool.query("INSERT INTO staging_mail_sends(owner_id,send_key,status,client_id,raw,subject,intended) VALUES($1,$2,'pending',$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING send_key",[owner,key,client.id,raw,message?.subject||summarySubject,message?.intended||client.email||'']);if(!intent.rows.length)throw Error('pending');
  const r=await request('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({raw}),signal:AbortSignal.timeout(20000)});
  if(!r.ok){if([400,401,403,404,429].includes(r.status))await pool.query('DELETE FROM staging_mail_sends WHERE owner_id=$1 AND send_key=$2',[owner,key]);throw Error('send');}
  const data=await r.json();if(!data.id)throw Error('uncertain');await pool.query("UPDATE staging_mail_sends SET status='sent',message_id=$3,sent_at=now() WHERE owner_id=$1 AND send_key=$2",[owner,key,data.id]);
  res.json({sent:true,recipient:RECIPIENT,messageId:data.id,payrollSentAt:message?.payrollSentAt});
 });
 const history=wrap(async(req,res)=>{const {rows}=await pool.query("SELECT send_key,subject,intended,sent_at,message_id,status FROM staging_mail_sends WHERE owner_id=$1 AND client_id=$2 ORDER BY sent_at DESC NULLS LAST",[req.user.id,req.query.clientId]);res.json({rows,recipient:RECIPIENT});});
 const download=wrap(async(req,res)=>{const {rows}=await pool.query("SELECT raw FROM staging_mail_sends WHERE owner_id=$1 AND send_key=$2 AND status='sent'",[req.user.id,req.params.key]);if(!rows[0]?.raw)return res.sendStatus(404);res.set('Content-Type','message/rfc822');res.set('Content-Disposition','attachment; filename="networth-email.eml"');res.send(Buffer.from(rows[0].raw,'base64url'));});
 return {status,send,history,download};
}
