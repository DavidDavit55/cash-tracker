import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.release/readiness-20261011-build');
const findings=[];let files=0;
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name),rel=path.relative(root,p);if(e.isSymbolicLink())throw Error('Symlink in artifact');if(e.isDirectory()){walk(p);continue;}files++;
 if(/(^|[\\/])(\.env[^\\/]*|credentials[^\\/]*|.*\.map|.*\.pem|.*\.key|october-preview\.json|budget-readonly\.html)$/i.test(rel))findings.push({file:rel,rule:'private-or-debug-file'});
 if(/\.(js|html|json|css|txt)$/i.test(p)){const text=fs.readFileSync(p,'utf8');for(const [rule,re]of [['private-key',/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/],['google-token',/ya29\.[A-Za-z0-9_-]{30,}/],['api-key',/sk-(?:proj-|ant-)?[A-Za-z0-9_-]{35,}/],['database-password',/postgres(?:ql)?:\/\/[^\s:"']+:[^\s@"']+@/]])if(re.test(text))findings.push({file:rel,rule});}
}}
walk(root);console.log(JSON.stringify({files,findings,limitation:'Pattern scan only; not proof of absence of all secrets or personal data'},null,2));process.exitCode=findings.length?1:0;
