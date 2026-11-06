import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import pg from '../backend/node_modules/pg/lib/index.js';
pg.types.setTypeParser(1082,v=>v);
const vars=JSON.parse(execFileSync(path.join(process.env.APPDATA,'npm/node_modules/@railway/cli/bin/railway.exe'),['variables','--json','--service','f6ff63cd-d2b7-475c-b6cc-6d59d379950a','--environment','46cf3fae-f54a-4b18-9a71-81d5ac0bf3b2'],{cwd:path.resolve('.release/inspection-20261002'),encoding:'utf8',stdio:['ignore','pipe','pipe']}));
if(!vars.DATABASE_PUBLIC_URL)throw Error('Public read endpoint unavailable');
const db=new pg.Client({connectionString:vars.DATABASE_PUBLIC_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:15000});
await db.connect();
try{
 await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const owner='b890f68f-5bdd-4d67-ac5b-16fe95ac16f0';
 const identity=(await db.query('SELECT phone FROM users WHERE id=$1',[owner])).rows[0];
 if(identity?.phone!=='0532556099')throw Error('Owner mismatch');
 const data={periods:['2026-10']};
 for(const [key,table,filter] of [['categories','categories','TRUE'],['expenses','expenses',"expense_date >= '2026-10-01' AND expense_date < '2026-11-01'"],['incomes','incomes',"income_date >= '2026-10-01' AND income_date < '2026-11-01'"],['budgets','budgets','year=2026 AND month=10'],['bankMovements','budget_bank_movements',"movement_date >= '2026-10-01' AND movement_date < '2026-11-01'"]]){
  data[key]=(await db.query(`SELECT * FROM ${table} WHERE user_id=$1 AND ${filter}`,[owner])).rows.map(({user_id,...row})=>row);
 }
 for(const row of data.expenses)row.category_name=data.categories.find(c=>c.id===row.category_id)?.name;
 await db.query('ROLLBACK');
 fs.mkdirSync('.staging-private',{recursive:true});
 fs.writeFileSync('.staging-private/october-preview.json',JSON.stringify(data));
 console.log(JSON.stringify({period:'2026-10',counts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])),productionWrites:0}));
}finally{await db.end();}
