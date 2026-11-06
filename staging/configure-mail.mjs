// Operator-only setup. Never included in the release artifact. No secret output.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cli='C:/Users/david/AppData/Roaming/npm/node_modules/@railway/cli/bin/railway.js';
const project='a95d9f88-a007-4eb5-833a-557ab7a53557';
const service='c1eebe6c-f129-4347-8560-c84227b98f41';
const environment='45c57b5b-5744-4ec0-9eab-f1a2d7ab8231';
const redirect='https://networth-staging-staging.up.railway.app/api/staging/mail/callback';
function run(args,input){const r=spawnSync(process.execPath,[cli,...args],{cwd:path.join(root,'.staging-release'),input,encoding:'utf8',windowsHide:true,timeout:60000});if(r.status!==0)throw Error('Railway command failed (details withheld to protect secrets)');return r.stdout;}
const status=JSON.parse(run(['status','--json']));
if(status.id!==project||!status.environments.edges.some(e=>e.node.id===environment&&e.node.name==='staging'))throw Error('Wrong project/environment');
const web=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).web;
if(web?.project_id!=='networth-crm'||web.client_id!=='55838643529-qebrdqfce3hhtnv8sfh7c52vdrpe0742.apps.googleusercontent.com'||!web.client_secret||!web.redirect_uris?.includes(redirect))throw Error('Unexpected OAuth client');
const existing=JSON.parse(run(['variable','list','-s',service,'-e',environment,'--json']));
if(existing.PILOT_MAIL_CLIENT_ID&&existing.PILOT_MAIL_CLIENT_ID!==web.client_id)throw Error('Refusing to replace a different client');
const values={PILOT_MAIL_CLIENT_ID:web.client_id,PILOT_MAIL_CLIENT_SECRET:web.client_secret,PILOT_MAIL_REDIRECT_URI:redirect,PILOT_MAIL_SENDER:'david@davit-fin.co.il',PILOT_MAIL_ENCRYPTION_KEY:existing.PILOT_MAIL_ENCRYPTION_KEY||randomBytes(32).toString('base64'),PILOT_MAIL_ENABLED:existing.PILOT_MAIL_ENABLED||'false'};
for(const [key,value] of Object.entries(values))run(['variable','set',key,'--stdin','--skip-deploys','-s',service,'-e',environment],value);
const verified=JSON.parse(run(['variable','list','-s',service,'-e',environment,'--json']));
if(Object.entries(values).some(([key,value])=>verified[key]!==value))throw Error('Configuration verification failed');
console.log(JSON.stringify({project:'NETWORTH-STAGING',environment:'staging',verifiedKeys:Object.keys(values),enabled:verified.PILOT_MAIL_ENABLED==='true',deploymentTriggered:false}));
