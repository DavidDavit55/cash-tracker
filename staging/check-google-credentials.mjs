// Read-only connectivity check. Never print credentials or client records.
import pg from '../backend/node_modules/pg/lib/index.js';
import {unseal} from '../backend/src/services/gmail.js';
import {calendarConfig} from './calendar.mjs';
if(process.env.APP_ENV!=='staging')throw Error('Staging only');
const pool=new pg.Pool({connectionString:process.env.DIAGNOSTIC_DATABASE_URL||process.env.DATABASE_URL,connectionTimeoutMillis:10000});
try{
 const c=calendarConfig(process.env);
 for(const kind of ['calendar','tasks']){
  const {rows}=await pool.query('SELECT x.owner_id,x.token FROM staging_'+kind+'_connections x JOIN users u ON u.id=x.owner_id WHERE u.email=$1',[process.env.ADMIN_EMAIL]);
  if(!rows.length){console.log(JSON.stringify({kind,connected:false}));continue;}
  const row=rows[0],saved=unseal(row.token,c.key,'staging-'+kind+':'+row.owner_id);
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.client_id,client_secret:c.client_secret,grant_type:'refresh_token',refresh_token:saved.refresh_token}),signal:AbortSignal.timeout(20000)});
  const d=await r.json();console.log(JSON.stringify({kind,status:r.status,error:d.error||null}));
 }
}catch(e){console.log(JSON.stringify({checkFailed:true,code:e.code||'check_failed'}));process.exitCode=1;}finally{await pool.end();}
