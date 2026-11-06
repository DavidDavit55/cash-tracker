// Local-only PostgreSQL runtime. Never reads DATABASE_URL or connects to a server.
import {PGlite} from '../.release/budget-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import {readFile} from 'node:fs/promises';
export async function localDatabase(){
 const db=new PGlite();
 const schema=await readFile(new URL('./src/db/schema.sql',import.meta.url),'utf8');
 await db.exec(schema.slice(schema.indexOf('CREATE TABLE'),schema.indexOf('-- פרופיל לקוח')).replaceAll('uuid_generate_v4()','gen_random_uuid()'));
 await db.exec(schema.slice(schema.indexOf('-- Budget imports:')).replaceAll('uuid_generate_v4()','gen_random_uuid()'));
 await db.exec('ALTER TABLE expenses ADD COLUMN payment_method text, ADD COLUMN card_number text; ALTER TABLE incomes ADD COLUMN includes_vat boolean DEFAULT false;');
 const pool={query:async(sql,params)=>{const r=await db.query(sql,params);return {...r,rowCount:r.rows.length||r.affectedRows||0};},connect:async()=>({...pool,release(){}})};
 return {db,pool};
}
