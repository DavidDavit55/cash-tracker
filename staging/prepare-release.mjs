// Explicit allowlist: no source reports, .env, uploads, browser storage or backups.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dest=path.join(root,'.staging-release');
const files=['backend/package.json','backend/package-lock.json','frontend/package.json','frontend/src/lib/pensionNetApi.js','.local-preview/public-fund-catalogue.mjs','staging/server.mjs','staging/gateway.js','staging/package.json','staging/Dockerfile'];
files.push('staging/calendar.mjs');
files.push('staging/crm-store.mjs','staging/files.mjs','.local-preview/appointment-edit.js','.local-preview/task-sync.js');
files.push('.local-preview/production-verification.js','.local-preview/agent-change-rules.js','.local-preview/info-appointment.js','frontend/src/lib/crmDisplay.js','frontend/src/sandbox/providerBrands.js');
files.push('.local-preview/appointment-names.js');
files.push('.local-preview/fee-change-agreement.js');
files.push('.local-preview/payroll-reply.js');
files.push('.local-preview/workflow-consolidation.js');
files.push('.local-preview/fund-allocation.js');
files.push('.local-preview/pension-verification.js','.local-preview/pension-flow.js');
files.push('staging/mail.mjs');
files.push('staging/mail-view.mjs');
files.push('staging/mail-sync.mjs');
files.push('staging/mail-automation.mjs','staging/mail-automation-rules.mjs','staging/mail-automation-extract.mjs','.local-preview/opening-mail.js');
files.push('staging/mail-automation-report.mjs');
files.push('staging/payroll-mail.mjs','.local-preview/payroll-text.js');
files.push('staging/delivery-mail.mjs');
files.push('staging/tasks.mjs','.local-preview/workflow-home-model.js','.local-preview/workflow-process.js','.local-preview/workflow-detail-rules.js','.local-preview/workflow-transfer-stages.js');
for(const entry of fs.readdirSync(path.join(root,'backend/src'),{recursive:true,withFileTypes:true})){
 if(entry.isFile()&&/\.(js|sql)$/.test(entry.name))files.push(path.relative(root,path.join(entry.parentPath,entry.name)));
}
for(const file of files){const out=path.join(dest,file);fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(path.join(root,file),out);}
fs.copyFileSync(path.join(root,'staging/railway.toml'),path.join(dest,'railway.toml'));
fs.copyFileSync(path.join(root,'staging/Dockerfile'),path.join(dest,'Dockerfile'));
const forbidden=fs.readdirSync(dest,{recursive:true}).filter(p=>/(^|[\\/])(\.env[^\\/]*|uploads|node_modules|.*\.map|.*\.xlsx|.*\.zip|.*\.eml|.*\.pdf)$/.test(p));
if(forbidden.length)throw Error('Forbidden deployment files: '+forbidden.join(', '));
console.log('Allowlisted staging artifact prepared:',files.length,'source files plus frontend build');
