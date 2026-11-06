import 'dotenv/config';
import pg from 'pg';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
const source='f8d4edd8-3fa9-4f29-a0a3-d9ee8ecc4e37',target='b890f68f-5bdd-4d67-ac5b-16fe95ac16f0';
const tables=['expenses','incomes','budgets','categories','merchant_categories'];
const client=await pool.connect();
try{
 await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
 await client.query('LOCK TABLE users,categories,expenses,incomes,budgets,merchant_categories IN SHARE ROW EXCLUSIVE MODE');
 const users=(await client.query('SELECT id,email,phone FROM users WHERE id=ANY($1::uuid[])',[ [source,target] ])).rows;
 if(users.find(u=>u.id===source)?.email!=='daviddavit55@gmail.com'||users.find(u=>u.id===target)?.phone!=='0532556099')throw Error('Identity mismatch');
 const backup={users,tables:{}};
 for(const t of tables)backup.tables[t]=(await client.query(`SELECT * FROM ${t} WHERE user_id=ANY($1::uuid[])`,[[source,target]])).rows;
 for(const t of tables.filter(t=>t!=='categories'))if(backup.tables[t].some(r=>r.user_id===target))throw Error('Destination has data; abort for review');
 const expected={expenses:366,incomes:55,budgets:20,merchant_categories:87};
 for(const [t,n]of Object.entries(expected))if(backup.tables[t].filter(r=>r.user_id===source).length!==n)throw Error('Source changed');
 const dir=new URL('../.release/account-backups/',import.meta.url);mkdirSync(dir,{recursive:true});
 const path=new URL(`david-budget-${Date.now()}.json`,dir);const payload=JSON.stringify(backup);writeFileSync(path,payload,{flag:'wx'});if(readFileSync(path,'utf8')!==payload)throw Error('Backup verification failed');
 const destinations=backup.tables.categories.filter(r=>r.user_id===target);
 for(const cat of backup.tables.categories.filter(r=>r.user_id===source)){
  const matches=destinations.filter(d=>d.name===cat.name);if(matches.length>1)throw Error('Ambiguous category');
  if(matches.length){for(const t of ['expenses','budgets','merchant_categories'])await client.query(`UPDATE ${t} SET category_id=$1 WHERE user_id=$2 AND category_id=$3`,[matches[0].id,source,cat.id]);}
  else await client.query('UPDATE categories SET user_id=$1 WHERE id=$2 AND user_id=$3',[target,cat.id,source]);
 }
 for(const [t,n]of Object.entries(expected)){
  const result=await client.query(`UPDATE ${t} SET user_id=$1 WHERE user_id=$2`,[target,source]);if(result.rowCount!==n)throw Error('Unexpected migration count');
  const after=(await client.query(`SELECT * FROM ${t} WHERE user_id=$1`,[target])).rows;
  const before=backup.tables[t].filter(r=>r.user_id===source);
  if(after.length!==n||after.some(r=>!before.some(b=>b.id===r.id&&(!('amount' in b)||b.amount===r.amount))))throw Error('Record verification failed');
 }
 for(const t of ['expenses','budgets','merchant_categories']){const {rows}=await client.query(`SELECT count(*)::int AS n FROM ${t} r JOIN categories c ON c.id=r.category_id WHERE r.user_id=$1 AND c.user_id<>$1`,[target]);if(rows[0].n)throw Error('Category ownership mismatch');}
 await client.query('COMMIT');console.log(JSON.stringify({status:'committed',counts:expected,backup:path.pathname}));
}catch(e){await client.query('ROLLBACK');console.error(e.message);process.exitCode=1;}finally{client.release();await pool.end();}
