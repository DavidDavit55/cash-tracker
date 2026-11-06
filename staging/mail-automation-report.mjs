import {mime,RECIPIENT} from './mail.mjs';
import {calendarConfig} from './calendar.mjs';
import {unseal,exchangeToken} from '../backend/src/services/gmail.js';
export const reportSchema=`CREATE TABLE IF NOT EXISTS staging_mail_automation_reports(owner_id uuid NOT NULL,report_key text NOT NULL,body text NOT NULL,status text NOT NULL DEFAULT 'queued',message_id text,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(owner_id,report_key));`;
export function reportBody(results){return ['NETWORTH — עיבוד מיילים בסטייג׳ינג',...results.map(r=>`${['advance','payroll'].includes(r.status)?'קודם':r.status==='attach'?'תויק':'לבדיקה'}: ${r.reason}\nלקוח: ${r.clientName||'טרם זוהה'}\nנושא: ${r.subject||'ללא נושא'}\nמייל מקור: ${r.mailId}`),'לא נשלחו הודעות ללקוחות או למעסיקים.'].join('\n\n');}
export function createAutomationReporter({pool,env=process.env,request=fetch}){
 return async owner=>{
  const rows=(await pool.query("SELECT * FROM staging_mail_automation_reports WHERE owner_id=$1 AND status='queued' ORDER BY created_at LIMIT 1",[owner])).rows;
  for(const row of rows){
   const connection=(await pool.query('SELECT token FROM staging_mail_connections WHERE owner_id=$1',[owner])).rows[0];if(!connection)return;
   const cfg=calendarConfig(env),saved=unseal(connection.token,cfg.key,'staging-mail:'+owner);
   const token=await exchangeToken(cfg,{grant_type:'refresh_token',refresh_token:saved.refresh_token},request);
   const claimed=await pool.query("UPDATE staging_mail_automation_reports SET status='sending' WHERE owner_id=$1 AND report_key=$2 AND status='queued' RETURNING report_key",[owner,row.report_key]);if(!claimed.rows.length)continue;
   try{
    // Fixed owner's test inbox. Never derive a recipient from an incoming email.
    const raw=mime(row.body,row.report_key,'NETWORTH — קידום משימות וחריגים [סטייגינג]');
    const r=await request('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({raw}),signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw Error('send_failed');const data=await r.json();if(!data.id)throw Error('uncertain');
    await pool.query("UPDATE staging_mail_automation_reports SET status='sent',message_id=$3 WHERE owner_id=$1 AND report_key=$2",[owner,row.report_key,data.id]);
   }catch{await pool.query("UPDATE staging_mail_automation_reports SET status='uncertain' WHERE owner_id=$1 AND report_key=$2",[owner,row.report_key]);}
  }
 };
}
