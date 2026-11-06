// Compare a local build against explicitly supplied private reference files.
// Never prints values, customer names, secret names, or matching snippets.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '../backend/node_modules/dotenv/lib/main.js';
export function scanKnownPrivateValues({artifact,envFiles=[],crmFiles=[]}){
 const needles=new Set();
 const add=v=>{if(typeof v==='string'&&v.trim().length>=8){needles.add(v.trim());needles.add(encodeURIComponent(v.trim()));}};
 for(const file of envFiles){const env=parse(fs.readFileSync(file));for(const [key,v]of Object.entries(env))if(/SECRET|PASSWORD|TOKEN|API_KEY|ENCRYPTION_KEY|SMTP_PASS|DATABASE_URL/i.test(key))add(v);}
 for(const file of crmFiles){const data=JSON.parse(fs.readFileSync(file,'utf8'));const state=data.state||data;for(const c of [...(state.clients||[]),...(state.deletedClients||[]).map(x=>x.client).filter(Boolean)]){for(const key of ['name','phone','email','identity'])add(c[key]);}}
 const findings=[];let checked=0;
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,e.name);if(e.isSymbolicLink())throw Error('Symlink not allowed');if(e.isDirectory()){walk(full);continue;}checked++;const content=fs.readFileSync(full);if([...needles].some(v=>content.includes(Buffer.from(v))))findings.push({file:path.relative(artifact,full),rule:'known-private-value'});}}
 walk(artifact);return {files:checked,referenceValues:needles.size,findings,limitation:'Only explicitly supplied local references; not a complete privacy or secret audit'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [artifact,...args]=process.argv.slice(2);if(!artifact)throw Error('Artifact required');const envFiles=[],crmFiles=[];for(let i=0;i<args.length;i+=2){if(!args[i+1])throw Error('Missing reference');if(args[i]==='--env')envFiles.push(args[i+1]);else if(args[i]==='--crm')crmFiles.push(args[i+1]);else throw Error('Unknown option');}const result=scanKnownPrivateValues({artifact:path.resolve(artifact),envFiles,crmFiles});console.log(JSON.stringify(result,null,2));process.exitCode=result.findings.length?1:0;}catch{console.error('Private-reference scan could not complete; no reference contents logged');process.exitCode=1;}
}
