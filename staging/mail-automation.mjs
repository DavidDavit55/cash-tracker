import {randomUUID,createHash} from 'node:crypto';
import {extractMail} from './mail-automation-extract.mjs';
import {planMail,applyOpeningPlan,mailKey,automationVersion} from './mail-automation-rules.mjs';
import {sourceMetadata} from './files.mjs';
import {reportBody} from './mail-automation-report.mjs';
export const automationSchema=`CREATE TABLE IF NOT EXISTS staging_mail_automation_settings(owner_id uuid PRIMARY KEY REFERENCES users(id),enabled boolean NOT NULL DEFAULT false);
ALTER TABLE staging_mail_automation_settings ADD COLUMN IF NOT EXISTS tasks_pending boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS staging_mail_automation(owner_id uuid NOT NULL REFERENCES users(id),mail_key text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(owner_id,mail_key));
CREATE TABLE IF NOT EXISTS staging_mail_automation_backups(owner_id uuid NOT NULL,run_id uuid PRIMARY KEY,revision integer NOT NULL,state jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());`;
export function createMailAutomation({pool,env=process.env,extract=extractMail,notify=async()=>{},syncTasks=async()=>false}){
 const running=new Set();
 const enabled=async owner=>(await pool.query('SELECT enabled FROM staging_mail_automation_settings WHERE owner_id=$1',[owner])).rows[0]?.enabled===true;
 async function run(owner,{apply=false}={}){
  if(running.has(owner))return {busy:true};running.add(owner);
  try{
   const initial=(await pool.query('SELECT state,revision FROM staging_crm WHERE owner_id=$1',[owner])).rows[0];if(!initial)return {results:[]};
   const messages=(await pool.query('SELECT * FROM staging_read_messages WHERE owner_id=$1 ORDER BY metadata->>\'at\',id',[owner])).rows;
   const prior=new Map((await pool.query('SELECT mail_key,result FROM staging_mail_automation WHERE owner_id=$1',[owner])).rows.map(r=>[r.mail_key,r.result]));
   const stateHash=createHash('sha256').update(JSON.stringify(initial.state.clients)).digest('hex');
   const pending=messages.filter(m=>{const old=prior.get(mailKey(m));return !old||old.status==='exception'&&(old.stateHash!==stateHash||old.version!==automationVersion);});
   const candidates=pending.slice(0,25),prepared=[];
   for(const m of candidates)prepared.push({m,extracted:await extract(m)});
   const results=[];let state=initial.state;
   if(!apply){for(const {m,extracted} of prepared)results.push(planMail(state,m,extracted));return {revision:initial.revision,results,remaining:pending.length-candidates.length,dryRun:true};}
   const db=await pool.connect();
   try{
    await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner]);
    const current=(await db.query('SELECT state,revision FROM staging_crm WHERE owner_id=$1 FOR UPDATE',[owner])).rows[0];state=current.state;
    let changed=false,backedUp=false;
    for(const {m,extracted} of prepared){
     const old=(await db.query('SELECT result FROM staging_mail_automation WHERE owner_id=$1 AND mail_key=$2',[owner,mailKey(m)])).rows[0]?.result;
     if(old&&old.status!=='exception')continue;
     const plan={...planMail(state,m,extracted),stateHash};
     if(['advance','attach','payroll'].includes(plan.status)){
      if(!backedUp){await db.query('INSERT INTO staging_mail_automation_backups(owner_id,run_id,revision,state) VALUES($1,$2,$3,$4)',[owner,randomUUID(),current.revision,JSON.stringify(current.state)]);backedUp=true;}
      if(plan.status==='payroll'){state=applyOpeningPlan(state,plan);changed=true;}
      else{
      const pdf=m.pdfs[plan.pdfIndex],bytes=Buffer.from(pdf.data,'base64'),meta=sourceMetadata({name:pdf.name,source:'company_pdf',bytes});
      const file=(await db.query(`INSERT INTO staging_crm_files(owner_id,client_id,id,source,name,mime,bytes,size,sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(owner_id,client_id,source,sha256) DO UPDATE SET sha256=EXCLUDED.sha256 RETURNING id,name,mime,size,sha256`,[owner,plan.clientId,randomUUID(),meta.source,meta.name,meta.mime,bytes,bytes.length,meta.sha256])).rows[0];
      state=applyOpeningPlan(state,plan,{...file,storage:'staging-private'});changed=true;
      }
     }
     if(plan.clientId&&!m.client_id)await db.query('UPDATE staging_read_messages SET client_id=$3 WHERE owner_id=$1 AND id=$2 AND client_id IS NULL',[owner,m.id,plan.clientId]);
     await db.query('INSERT INTO staging_mail_automation(owner_id,mail_key,result) VALUES($1,$2,$3) ON CONFLICT(owner_id,mail_key) DO UPDATE SET result=EXCLUDED.result,created_at=now()',[owner,plan.key,JSON.stringify(plan)]);
     if(!old||old.status!==plan.status||old.reason!==plan.reason)results.push(plan);
    }
    if(changed){await db.query('UPDATE staging_crm SET state=$2,revision=revision+1 WHERE owner_id=$1',[owner,JSON.stringify(state)]);await db.query('UPDATE staging_mail_automation_settings SET tasks_pending=true WHERE owner_id=$1',[owner]);}
    const actionable=results.filter(r=>r.status!=='ignored');
    if(actionable.length){const key=createHash('sha256').update(actionable.map(r=>JSON.stringify([r.key,r.status,r.reason])).sort().join('|')).digest('hex');await db.query('INSERT INTO staging_mail_automation_reports(owner_id,report_key,body) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[owner,key,reportBody(actionable)]);}
    await db.query('COMMIT');
   }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
   if((await pool.query('SELECT tasks_pending FROM staging_mail_automation_settings WHERE owner_id=$1',[owner])).rows[0]?.tasks_pending&&await syncTasks(owner))await pool.query('UPDATE staging_mail_automation_settings SET tasks_pending=false WHERE owner_id=$1',[owner]);
   await notify(owner);
   return {results,dryRun:false,remaining:Math.max(0,pending.length-candidates.length)};
  }finally{running.delete(owner);}
 }
 const status=async(req,res)=>{try{const {rows}=await pool.query('SELECT result,created_at FROM staging_mail_automation WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 500',[req.user.id]);const reports=(await pool.query('SELECT report_key,status,created_at FROM staging_mail_automation_reports WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 20',[req.user.id])).rows;res.json({enabled:await enabled(req.user.id),running:running.has(req.user.id),rows,reports});}catch{res.sendStatus(500);}};
 const configure=async(req,res)=>{if(typeof req.body.enabled!=='boolean')return res.sendStatus(400);try{await pool.query('INSERT INTO staging_mail_automation_settings(owner_id,enabled) VALUES($1,$2) ON CONFLICT(owner_id) DO UPDATE SET enabled=EXCLUDED.enabled',[req.user.id,req.body.enabled]);res.json({enabled:req.body.enabled});}catch{res.sendStatus(500);}};
 const preview=async(req,res)=>{try{res.json(await run(req.user.id));}catch{res.status(500).json({error:'בדיקת המיילים נכשלה; לא בוצע שינוי'});}};
 return {run,status,preview,configure,afterSync:async owner=>await enabled(owner)?run(owner,{apply:true}):undefined};
}
