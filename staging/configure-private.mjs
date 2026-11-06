// Generated keys remain outside the release artifact. Never print their values.
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'.staging-private');fs.mkdirSync(dir,{recursive:true});
const keyfile=path.join(dir,'credentials.json');
if(!fs.existsSync(keyfile))fs.writeFileSync(keyfile,JSON.stringify({STAGING_ACCESS_KEY:randomBytes(32).toString('base64url'),JWT_SECRET:randomBytes(32).toString('base64url')},null,2),{mode:0o600,flag:'wx'});
const cli=path.join(process.env.APPDATA,'npm/node_modules/@railway/cli/bin/railway.js');
const opts={cwd:path.join(root,'.staging-release'),encoding:'utf8'};
const status=spawnSync(process.execPath,[cli,'status','--json'],opts);
if(status.status!==0)throw Error('Cannot verify target');
const target=JSON.parse(status.stdout);
if(target.id!=='a95d9f88-a007-4eb5-833a-557ab7a53557')throw Error('Wrong project; refusing configuration');
for(const [key,value] of Object.entries({...JSON.parse(fs.readFileSync(keyfile,'utf8')),APP_ENV:'staging',NODE_ENV:'production',ADMIN_EMAIL:'staging-admin@example.invalid',DATABASE_URL:'${{Postgres.DATABASE_URL}}',PORT:'3001'})){
 const r=spawnSync(process.execPath,[cli,'variable','set',key,'--stdin','--skip-deploys','-s','c1eebe6c-f129-4347-8560-c84227b98f41','-e','staging'],{...opts,input:value});
 if(r.status!==0)throw Error('Variable configuration failed: '+key);
 console.log('Configured '+key+' (value hidden)');
}
