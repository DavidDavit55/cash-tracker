import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import pg from '../backend/node_modules/pg/lib/index.js';
pg.types.setTypeParser(1082,v=>v);
const root=process.cwd(),apply=process.argv.includes('--apply');
function vars(cwd,service,environment){return JSON.parse(execFileSync(path.join(process.env.APPDATA,'npm/node_modules/@railway/cli/bin/railway.exe'),['variables','--json','--service',service,'--environment',environment],{cwd:path.join(root,cwd),encoding:'utf8',stdio:['ignore','pipe','pipe']}));}
const prodVars=vars('.release/inspection-20261002','f6ff63cd-d2b7-475c-b6cc-6d59d379950a','46cf3fae-f54a-4b18-9a71-81d5ac0bf3b2');
const stageVars=vars('.staging-release','40d20e31-4964-4012-aae8-d4dfe37a785d','45c57b5b-5744-4ec0-9eab-f1a2d7ab8231');
if(!prodVars.DATABASE_PUBLIC_URL||!stageVars.DATABASE_PUBLIC_URL||prodVars.DATABASE_PUBLIC_URL===stageVars.DATABASE_PUBLIC_URL)throw Error('Distinct public database endpoints required');
const source=new pg.Client({connectionString:prodVars.DATABASE_PUBLIC_URL,ssl:{rejectUnauthorized:false}}),target=new pg.Client({connectionString:stageVars.DATABASE_PUBLIC_URL,ssl:{rejectUnauthorized:false}});
const owner='b890f68f-5bdd-4d67-ac5b-16fe95ac16f0';
const filters={categories:'TRUE',expenses:"expense_date >= '2026-10-01' AND expense_date < '2026-11-01'",incomes:"income_date >= '2026-10-01' AND income_date < '2026-11-01'",budgets:'month=10 AND year=2026',budget_bank_movements:"movement_date >= '2026-10-01' AND movement_date < '2026-11-01'"};
await source.connect();await target.connect();
try{
 await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await target.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
 const identity=(await source.query('SELECT id,phone FROM users WHERE id=$1',[owner])).rows[0];if(identity?.phone!=='0532556099')throw Error('Source identity mismatch');
 const users=(await target.query("SELECT id FROM users WHERE email='staging-admin@example.invalid' FOR UPDATE")).rows;if(users.length!==1)throw Error('Staging owner not uniquely identified');const dest=users[0].id;
 const data={},before={};for(const [table,filter]of Object.entries(filters)){data[table]=(await source.query(`SELECT * FROM ${table} WHERE user_id=$1 AND ${filter}`,[owner])).rows;before[table]=(await target.query(`SELECT * FROM ${table} WHERE user_id=$1 AND ${filter}`,[dest])).rows;}
 const counts=Object.fromEntries(Object.keys(data).map(t=>[t,{source:data[t].length,destination:before[t].length}]));console.log(JSON.stringify({period:'2026-10',counts,apply}));
 if(Object.keys(before).some(t=>t!=='categories'&&before[t].length))throw Error('Destination October data already exists; no overwrite permitted');
 const mapped=new Map(),operations=[];
 for(const c of data.categories){const matches=before.categories.filter(x=>x.name===c.name);if(matches.length>1)throw Error('Ambiguous destination category');const id=matches[0]?.id||randomUUID();mapped.set(c.id,id);if(!matches.length)operations.push(['categories',{...c,id,user_id:dest}]);}
 for(const table of ['expenses','incomes','budgets','budget_bank_movements'])for(const row of data[table]){const copy={...row,id:randomUUID(),user_id:dest};mapped.set(row.id,copy.id);if(row.category_id){if(!mapped.has(row.category_id))throw Error('Missing category mapping');copy.category_id=mapped.get(row.category_id);}if(row.ledger_id){if(!mapped.has(row.ledger_id))throw Error('Bank ledger outside October scope');copy.ledger_id=mapped.get(row.ledger_id);}operations.push([table,copy]);}
 if(apply){const folder=path.join(root,'.staging-private','backups','october-budget-'+Date.now());fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'before-and-source.json'),JSON.stringify({period:'2026-10',sourceOwner:owner,targetOwner:dest,before,data}),{flag:'wx'});
 for(const [table,row]of operations){const keys=Object.keys(row);await target.query(`INSERT INTO ${table}(${keys.map(k=>'"'+k+'"').join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>row[k]!==null&&typeof row[k]==='object'&&!(row[k] instanceof Date)?JSON.stringify(row[k]):row[k]));}
 const totals={};for(const table of ['expenses','incomes','budgets']){const rows=(await target.query(`SELECT * FROM ${table} WHERE user_id=$1 AND ${filters[table]}`,[dest])).rows;const sum=rs=>rs.reduce((n,r)=>n+Math.round(Number(r.amount)*100),0);if(rows.length!==data[table].length||sum(rows)!==sum(data[table]))throw Error('Verification mismatch '+table);totals[table]={count:rows.length,amount:sum(rows)/100};}
 await target.query('COMMIT');fs.writeFileSync(path.join(folder,'result.json'),JSON.stringify({counts,totals,inserted:operations.map(([table,row])=>({table,id:row.id})),productionWrites:0}),{flag:'wx'});console.log(JSON.stringify({committed:true,totals,backup:path.basename(folder),productionWrites:0}));
 }else await target.query('ROLLBACK');await source.query('ROLLBACK');
}catch(e){await target.query('ROLLBACK');await source.query('ROLLBACK');console.error(e.message);process.exitCode=1;}finally{await source.end();await target.end();}
