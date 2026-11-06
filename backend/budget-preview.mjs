import {registerReceiptScan} from './src/routes/expenses.js';
// Explicitly launched local demo; in-memory data only. Not imported by src/index.js.
import express from 'express';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {localDatabase} from './budget-test-db.mjs';
import {createBudgetWorkspaceRouter} from './src/routes/budgetWorkspace.js';
const {pool}=await localDatabase();
const backup=JSON.parse(await readFile(new URL('../.release/account-backups/david-budget-1790443369241.json',import.meta.url),'utf8'));
const statePath=new URL('../.release/budget-preview/saved-state.json',import.meta.url);
let savedState;try{savedState=JSON.parse(await readFile(statePath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(savedState)Object.assign(backup.tables,savedState.tables);
const user='11111111-1111-4111-8111-111111111111';
await pool.query("INSERT INTO users(id,email,password_hash,name) VALUES($1,'local@preview','unused','דוד')",[user]);
const catMap=new Map(),names=new Map();
for(const row of backup.tables.categories){if(names.has(row.name)){catMap.set(row.id,names.get(row.name));continue;}names.set(row.name,row.id);catMap.set(row.id,row.id);}
for(const table of ['categories','expenses','incomes','budgets','merchant_categories','budget_imports','budget_bank_movements','budget_bank_rules']){
 const columns=new Set((await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name=$1',[table])).rows.map(r=>r.column_name));
 for(const original of backup.tables[table]||[]){
  if(table==='categories'&&catMap.get(original.id)!==original.id)continue;
  const row={...original,user_id:user};if(row.category_id)row.category_id=catMap.get(row.category_id)||null;
  // Backup serializes PostgreSQL DATE as local-midnight ISO; restore its Israeli calendar date.
  for(const key of ['expense_date','income_date','movement_date'])if(row[key]?.includes('T'))row[key]=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(row[key]));
  const keys=Object.keys(row).filter(k=>columns.has(k));await pool.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>row[k]!==null&&typeof row[k]==='object'?JSON.stringify(row[k]):row[k]));
 }
}
const app=express();app.use(express.json());
let saveQueue=Promise.resolve();
app.use((req,res,next)=>{res.on('finish',()=>{if(req.method==='GET'||res.statusCode>=400)return;saveQueue=saveQueue.then(async()=>{const tables={};for(const t of ['categories','expenses','incomes','budgets','merchant_categories','budget_imports','budget_bank_movements','budget_bank_rules'])tables[t]=(await pool.query('SELECT * FROM '+t)).rows;const temp=new URL('../.release/budget-preview/state.tmp',import.meta.url);await writeFile(temp,JSON.stringify({savedAt:new Date().toISOString(),tables},null,2));await rename(temp,statePath);}).catch(e=>console.error('Local snapshot failed:',e.message));});next();});
app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');if(req.headers.origin&&!/^http:\/\/127\.0\.0\.1:4187$/.test(req.headers.origin))return res.sendStatus(403);next();});
const receiptRouter=express.Router();registerReceiptScan(receiptRouter);app.use('/api/expenses',receiptRouter);
app.use('/api/budget-workspace',createBudgetWorkspaceRouter(pool,(req,res,next)=>{req.user={id:user};next();}));
app.post('/api/budgets',async(req,res)=>{const {category_id,amount,month,year}=req.body;if(!(await pool.query('SELECT id FROM categories WHERE id=$1 AND user_id=$2',[category_id,user])).rowCount)return res.sendStatus(400);res.json((await pool.query('INSERT INTO budgets(user_id,category_id,amount,month,year) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,category_id,month,year) DO UPDATE SET amount=$3 RETURNING *',[user,category_id,amount,month,year])).rows[0]);});
app.patch('/api/expenses/:id',async(req,res)=>{res.json((await pool.query('UPDATE expenses SET category_id=$1,updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING *',[req.body.category_id,req.params.id,user])).rows[0]);});
app.listen(4188,'127.0.0.1',()=>console.log('Isolated budget preview API: 127.0.0.1:4188; in-memory copy only'));
