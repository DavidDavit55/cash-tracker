import 'dotenv/config';
import pg from 'pg';
import {readFileSync,writeFileSync} from 'node:fs';
const target='b890f68f-5bdd-4d67-ac5b-16fe95ac16f0';
const local=JSON.parse(readFileSync('../.release/20260927-private/local.json')).tables;
const original=JSON.parse(readFileSync('../.release/account-backups/david-budget-1790443369241.json')).tables;
const db=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:15000});
const apply=process.argv.includes('--apply');
await db.connect();
try{
 await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
 const tables=Object.keys(local),live={};
 for(const t of tables){const exists=(await db.query('SELECT to_regclass($1) AS t',[t])).rows[0].t;live[t]=exists?(await db.query(`SELECT * FROM ${t} WHERE user_id=$1 FOR UPDATE`,[target])).rows:[];}
 if((await db.query('SELECT phone FROM users WHERE id=$1',[target])).rows[0]?.phone!=='0532556099')throw Error('Identity mismatch');
 const cats=new Map([...original.categories,...local.categories,...live.categories].map(c=>[c.id,c.name]));
 const categoryId=id=>id?live.categories.find(c=>c.name===cats.get(id))?.id:null;
 const dateFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'});
 const calendar=v=>dateFormatter.format(new Date(v));
 function norm(row){const r={...row,user_id:target};if(r.category_id){r.category_id=categoryId(r.category_id);if(!r.category_id)throw Error('Category missing');}for(const k of ['expense_date','income_date','movement_date'])if(r[k])r[k]=calendar(r[k]);return r;}
 const equal=(a,b)=>String(a instanceof Date?a.toISOString():a??'')===String(b instanceof Date?b.toISOString():b??'');
 const stats={},conflicts=[],operations=[];
 for(const t of tables.filter(t=>!['categories','budget_imports'].includes(t))){
  stats[t]={insert:0,update:0};
  const normalizedLive=live[t].map(norm),normalizedOriginal=original[t]?.map(norm);
  for(const item of local[t]){
   const row=norm(item);
   const match=r=>t==='budgets'?r.category_id===row.category_id&&r.month===row.month&&r.year===row.year:t==='merchant_categories'?r.merchant===row.merchant:t==='budget_bank_rules'?r.source===row.source&&r.label_key===row.label_key&&r.original_kind===row.original_kind:r.id===row.id;
   const current=normalizedLive.find(match);
   const baseline=normalizedOriginal?.find(match);
   if(!current){operations.push({t,row,insert:true});stats[t].insert++;continue;}
   const changes={};
   for(const key of Object.keys(row).filter(k=>!['id','user_id','created_at','updated_at'].includes(k))){
    if(typeof row[key]==='object'){if(JSON.stringify(row[key])!==JSON.stringify(current[key]))conflicts.push({t,id:row.id,key});continue;}
    if(equal(row[key],current[key]))continue;
    if(baseline&&equal(row[key],baseline[key]))continue;
    if(!baseline||!equal(current[key],baseline[key])){conflicts.push({t,id:row.id,key});continue;}
    changes[key]=row[key];
   }
   if(Object.keys(changes).length){operations.push({t,row:{...changes,id:current.id,user_id:target},insert:false});stats[t].update++;}
  }
 }
 console.log(JSON.stringify({stats,conflicts},null,2));
 if(conflicts.length)throw Error('Conflicts require review');
 if(apply){
  writeFileSync('../.release/20260927-private/pre-sync.json',JSON.stringify(live,null,2),{flag:'wx'});
  for(const op of operations){const {t,row}=op;const keys=Object.keys(row);if(op.insert){await db.query(`INSERT INTO ${t}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>row[k]!==null&&typeof row[k]==='object'?JSON.stringify(row[k]):row[k]));}else{const fields=keys.filter(k=>!['id','user_id'].includes(k));await db.query(`UPDATE ${t} SET ${fields.map((k,i)=>k+'=$'+(i+1)).join(',')} WHERE id=$${fields.length+1} AND user_id=$${fields.length+2}`,[...fields.map(k=>row[k]),row.id,target]);}}
  // Preserve import snapshots with the destination owner and category IDs.
  // Use database-returned snapshots only when every original field still matches;
  // edited rows keep a differing snapshot so undo remains blocked.
  for(const batch of local.budget_imports){if(live.budget_imports.some(r=>r.id===batch.id))continue;const row={...batch,user_id:target};row.records=[];for(const record of batch.records){const mapped=norm(record.row);const t=record.kind==='bank'?'budget_bank_movements':record.kind==='expense'?'expenses':'incomes';const actual=(await db.query(`SELECT * FROM ${t} WHERE id=$1 AND user_id=$2`,[mapped.id,target])).rows[0];const normalized=actual&&norm(actual);const matches=normalized&&Object.keys(mapped).every(k=>typeof mapped[k]==='object'?JSON.stringify(mapped[k])===JSON.stringify(normalized[k]):equal(mapped[k],normalized[k]));row.records.push({...record,row:matches?actual:mapped});}const keys=Object.keys(row);await db.query(`INSERT INTO budget_imports(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>typeof row[k]==='object'&&row[k]!==null?JSON.stringify(row[k]):row[k]));}
  const counts={};for(const t of tables)counts[t]=(await db.query(`SELECT count(*)::int AS n FROM ${t} WHERE user_id=$1`,[target])).rows[0].n;
  await db.query('COMMIT');writeFileSync('../.release/20260927-private/sync-result.json',JSON.stringify({stats,counts},null,2));console.log(JSON.stringify({committed:true,counts}));
 }else await db.query('ROLLBACK');
}catch(e){await db.query('ROLLBACK');console.error(e.message);process.exitCode=1;}finally{await db.end();}
