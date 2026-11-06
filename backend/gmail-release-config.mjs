// Local deployment helper. Never include this file or downloaded credentials in the upload.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
const cwd=path.resolve('.release/20260927-gmail/backend');
const cli='C:/Users/david/AppData/Roaming/npm/node_modules/@railway/cli/bin/railway.exe';
function run(args,input){return execFileSync(cli,args,{cwd,input,encoding:'utf8',stdio:['pipe','pipe','pipe']});}
try{
 const status=JSON.parse(run(['status','--json']));
 if(status.id!=='325bab1a-8ede-4c26-a00f-1183ed99846c')throw new Error('target');
 const args=['-s','cef79ba4-7f7b-497a-8df9-7d3609a63e15','-e','production'];
 const vars=JSON.parse(run(['variable','list',...args,'--json']));
 if(vars.ADMIN_EMAIL!=='david@davit-fin.co.il'||!vars.FRONTEND_URL.split(',').map(s=>s.trim()).includes('https://networth.davit-fin.co.il'))throw new Error('config');
 const {web}=JSON.parse(readFileSync('C:/Users/david/Downloads/client_secret_2_55838643529-4vjj723vo0r69gua2o54p0p5vqigdi93.apps.googleusercontent.com.json','utf8'));
 if(web.project_id!=='networth-crm'||!web.client_secret?.endsWith('bpYP'))throw new Error('credential');
 const key=vars.GMAIL_ENCRYPTION_KEY||randomBytes(32).toString('base64');
 if(Buffer.from(key,'base64').length!==32)throw new Error('key');
 const settings={GMAIL_ENABLED:'true',GMAIL_ALLOWED_EMAILS:'david@davit-fin.co.il,daviddavit55@gmail.com',GMAIL_CLIENT_ID:web.client_id,GMAIL_CLIENT_SECRET:web.client_secret,GMAIL_ENCRYPTION_KEY:key,GMAIL_REDIRECT_URI:'https://cash-tracker-production-35dd.up.railway.app/api/admin/gmail/callback',GMAIL_FRONTEND_URL:'https://networth.davit-fin.co.il'};
 for(const [name,value] of Object.entries(settings))run(['variable','set',name,...args,'--stdin','--skip-deploys'],value);
 const verified=JSON.parse(run(['variable','list',...args,'--json']));
 if(Object.entries(settings).some(([k,v])=>verified[k]!==v))throw new Error('verification');
 console.log('Gmail configuration stored and verified; no deployment triggered, no credentials printed.');
}catch{console.error('Gmail configuration failed. No secret details emitted.');process.exitCode=1;}
