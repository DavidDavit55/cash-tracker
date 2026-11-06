// Operator only; excluded from the release. Enables only the isolated calendar pilot.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../.staging-release/',import.meta.url));
const cli='C:/Users/david/AppData/Roaming/npm/node_modules/@railway/cli/bin/railway.js';
const service='c1eebe6c-f129-4347-8560-c84227b98f41',environment='45c57b5b-5744-4ec0-9eab-f1a2d7ab8231';
function run(args,input){const r=spawnSync(process.execPath,[cli,...args],{cwd,input,encoding:'utf8',windowsHide:true,timeout:60000});if(r.status!==0)throw Error('Railway operation failed; output withheld');return r.stdout;}
const status=JSON.parse(run(['status','--json']));
if(status.id!=='a95d9f88-a007-4eb5-833a-557ab7a53557'||!status.environments.edges.some(e=>e.node.id===environment&&e.node.name==='staging'))throw Error('Unexpected deployment target');
const vars=JSON.parse(run(['variable','list','-s',service,'-e',environment,'--json']));
if(vars.PILOT_MAIL_CLIENT_ID!=='55838643529-qebrdqfce3hhtnv8sfh7c52vdrpe0742.apps.googleusercontent.com'||!vars.PILOT_MAIL_CLIENT_SECRET||Buffer.from(vars.PILOT_MAIL_ENCRYPTION_KEY||'','base64').length!==32||vars.PILOT_MAIL_ENABLED!=='false')throw Error('Unexpected pilot configuration');
run(['variable','set','PILOT_CALENDAR_ENABLED','--stdin','--skip-deploys','-s',service,'-e',environment],'true');
const verified=JSON.parse(run(['variable','list','-s',service,'-e',environment,'--json']));
if(verified.PILOT_CALENDAR_ENABLED!=='true')throw Error('Flag not verified');
console.log('Verified: isolated staging Calendar enabled; Gmail remains disabled. No deployment triggered.');
