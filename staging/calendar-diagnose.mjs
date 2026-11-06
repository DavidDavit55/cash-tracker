// Read-only Google/DB diagnosis inside the isolated service. Never prints tokens or client data.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const remote=`
if(process.env.APP_ENV!=='staging'||process.env.RAILWAY_PROJECT_ID!=='a95d9f88-a007-4eb5-833a-557ab7a53557')throw Error('wrong_target');
const {default:pool}=await import('./backend/src/db/pool.js');
const {unseal,exchangeToken}=await import('./backend/src/services/gmail.js');
const {calendarConfig}=await import('./staging/calendar.mjs');
try {
 const c=calendarConfig(process.env);
 const {rows}=await pool.query('SELECT owner_id,token,calendar_id,creating FROM staging_calendar_connections');
 for(const row of rows){
  const saved=unseal(row.token,c.key,'staging-calendar:'+row.owner_id);
  const t=await exchangeToken(c,{grant_type:'refresh_token',refresh_token:saved.refresh_token});
  const info=await fetch('https://oauth2.googleapis.com/tokeninfo?access_token='+encodeURIComponent(t.access_token),{signal:AbortSignal.timeout(15000)});
  const scope=await info.json();
  console.log(JSON.stringify({connected:true,calendarReady:!!row.calendar_id,uncertain:row.creating,scopes:scope.scope?.split(' ')}));
  // Metadata read only. app.created cannot read primary; an insufficient-scope response is expected when API is enabled.
  const result=await fetch('https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(row.calendar_id||'primary'),{headers:{Authorization:'Bearer '+t.access_token},signal:AbortSignal.timeout(15000)});
  const body=await result.json();
  console.log(JSON.stringify({googleStatus:result.status,errorStatus:body.error?.status,reasons:body.error?.errors?.map(e=>e.reason),details:body.error?.details?.map(d=>({reason:d.reason,service:d.metadata?.service,consumer:d.metadata?.consumer,activationUrl:d.metadata?.activationUrl}))}));
 }
}catch(e){console.log(JSON.stringify({diagnosticError:e.message,status:e.status}));process.exitCode=1;}finally{await pool.end();}
`;
const encoded=Buffer.from(remote).toString('base64');
const command=`node --input-type=module -e "eval(Buffer.from('${encoded}','base64').toString())"`;
const cli='C:/Users/david/AppData/Roaming/npm/node_modules/@railway/cli/bin/railway.js';
if(process.argv.includes('--direct')){
 const run=args=>{const r=spawnSync(process.execPath,[cli,...args],{cwd:fileURLToPath(new URL('../.staging-release/',import.meta.url)),encoding:'utf8',timeout:30000,windowsHide:true});if(r.status!==0)throw Error('Configuration read failed');return JSON.parse(r.stdout);};
 const environment='45c57b5b-5744-4ec0-9eab-f1a2d7ab8231';
 const server=run(['variable','list','-s','c1eebe6c-f129-4347-8560-c84227b98f41','-e',environment,'--json']);
 if(server.RAILWAY_PROJECT_ID!=='a95d9f88-a007-4eb5-833a-557ab7a53557'||server.APP_ENV!=='staging')throw Error('wrong_target');
 const db=run(['variable','list','-s','40d20e31-4964-4012-aae8-d4dfe37a785d','-e',environment,'--json']);
 if(!db.DATABASE_PUBLIC_URL)throw Error('No isolated public database route');
 const source=remote.replace("const {default:pool}=await import('./backend/src/db/pool.js');","const {default:pg}=await import('./backend/node_modules/pg/lib/index.js');const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:15000});");
 const child=spawnSync(process.execPath,['--input-type=module','-e',source],{env:{...process.env,...server,DATABASE_URL:db.DATABASE_PUBLIC_URL},encoding:'utf8',timeout:50000,windowsHide:true});
 console.log(child.stdout);if(child.status!==0){console.log('Direct read-only diagnosis failed.');process.exitCode=1;}
}else{
const r=spawnSync(process.execPath,[cli,'ssh','-p','a95d9f88-a007-4eb5-833a-557ab7a53557','-e','45c57b5b-5744-4ec0-9eab-f1a2d7ab8231','-s','c1eebe6c-f129-4347-8560-c84227b98f41',command],{encoding:'utf8',timeout:55000,windowsHide:true});
console.log(r.stdout);if(r.status!==0){console.log('Remote diagnostic unavailable:',r.stderr?.slice(0,600));process.exitCode=1;}
}
