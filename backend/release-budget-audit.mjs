import 'dotenv/config';
import pg from 'pg';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const db=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:15000});
const user='b890f68f-5bdd-4d67-ac5b-16fe95ac16f0';
const local=JSON.parse(readFileSync('../.release/budget-preview/saved-state.json','utf8'));
await db.connect();
try{
 await db.query('BEGIN READ ONLY');
 const tables={}, columns={};
 for(const t of Object.keys(local.tables)){
 columns[t]=(await db.query('SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=\'public\' AND table_name=$1',[t])).rows;
 tables[t]=columns[t].length?(await db.query(`SELECT * FROM ${t} WHERE user_id=$1`,[user])).rows:[];
 }
 mkdirSync('../.release/20260927-private',{recursive:true});
 writeFileSync('../.release/20260927-private/live-before.json',JSON.stringify({tables,columns},null,2),{flag:'wx'});
 writeFileSync('../.release/20260927-private/local.json',JSON.stringify(local,null,2),{flag:'wx'});
 console.log(JSON.stringify(Object.fromEntries(Object.keys(tables).map(t=>[t,{live:tables[t].length,local:local.tables[t].length,columns:columns[t].map(c=>c.column_name)}])),null,2));
 await db.query('ROLLBACK');
}finally{await db.end();}
