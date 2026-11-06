import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import express from 'express';
import {readFile} from 'node:fs/promises';
import {parseBudget,annotateDuplicates,date} from './src/services/budgetLedger.js';
import {createBudgetWorkspaceRouter} from './src/routes/budgetWorkspace.js';
import {localDatabase} from './budget-test-db.mjs';
function workbook(rows){const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet(rows),'תנועות');return XLSX.write(w,{type:'buffer',bookType:'xlsx'});}
test('refunds, currency, dates and duplicate multiplicity',()=>{
 const parsed=parseBudget(workbook([['תאריך עסקה','שם בית העסק','סכום חיוב','מטבע חיוב'],['01/09/2026','חנות',25,'₪'],['01/09/2026','חנות',25,'₪'],['02/09/2026','זיכוי',-10,'₪'],['03/09/2026','זר',8,'USD']]),'max');
 assert.equal(parsed.items.length,3);assert.equal(parsed.items[2].amount,-10);assert.equal(parsed.issues.length,1);
 const d=annotateDuplicates(parsed.items,[parsed.items[0]]);assert.deepEqual(d.map(r=>r.include),[false,true,true]);assert.equal(date('31/02/2026'),null);
});
test('provided files reconcile card totals and isolate bank warnings',async()=>{
 const paths=[['discount','עובר ושב_13092026_2214.xlsx'],['cal','פירוט עסקאות וזיכויים (1).xlsx'],['max','transaction-details_export_1789326873805.xlsx']];
 for(const [source,name] of paths){const p=parseBudget(await readFile('C:/Users/david/Downloads/'+name),source);const sum=Math.round(p.items.reduce((s,r)=>s+r.amount,0)*100)/100;
  console.log(source,{count:p.items.length,issues:p.issues.length,refunds:p.items.filter(r=>r.amount<0).length,sum});
  assert.equal(p.issues.length,0);if(source==='cal'){assert.equal(Math.round(p.items.filter(r=>r.include).reduce((s,r)=>s+r.amount,0)*100)/100,6183.91);assert.equal(p.items.filter(r=>r.amount<0).length,3);}if(source==='max')assert.equal(sum,2920.86);if(source==='discount')assert(p.items.some(r=>r.warning.includes('עתידית')&&!r.include));
 }
});
test('wrong source cannot invert bank debits and cash movements',()=>{
 const bank=workbook([['תאריך','תיאור','זכות/חובה'],['01/09/2026','קניה',-100]]);
 assert.throws(()=>parseBudget(bank,'cal'),/דיסקונט/);
 assert.equal(parseBudget(bank,'discount').items[0].amount,100);
 const card=workbook([['תאריך עסקה','שם בית העסק','סכום חיוב','מטבע חיוב'],['01/09/2026','קניה',100,'₪']]);
 assert.throws(()=>parseBudget(card,'discount'),/מקס/);
});
test('preview, commit, repeat protection, ownership, cash and undo use isolated database',async()=>{
 const {db,pool}=await localDatabase();const u='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 await pool.query("INSERT INTO users(id,email,password_hash,name) VALUES($1,'local@test','unused','local'),($2,'other@test','unused','other')",[u,other]);
 const app=express();app.use(express.json());app.use(createBudgetWorkspaceRouter(pool,(req,res,next)=>{req.user={id:req.headers['x-local-user']||u};next();}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}`;
 const call=async(path,body,user)=>{const r=await fetch(url+path,{method:body?'POST':'GET',headers:{...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...(user?{'x-local-user':user}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 const file=workbook([['תאריך','תיאור','סוג','סכום'],['01/09/2026','קניה','הוצאה',40],['02/09/2026','הכנסה','הכנסה',80]]);
 const preview=async()=>{const fd=new FormData();fd.append('source','cash');fd.append('file',new Blob([file]),'cash.xlsx');return call('/preview',fd);};
 try{
  const p=await preview();assert.equal(p.status,200);assert.equal((await pool.query('SELECT * FROM expenses')).rows.length,0);
  const path='/imports/'+p.data.id;assert.equal((await call(path+'/commit',{selected:['0','1']},other)).status,404);
  assert.equal((await call(path+'/commit',{selected:['0','1']})).data.imported,2);assert.equal((await call(path+'/commit',{selected:['0','1']})).data.imported,2);
  assert.equal((await preview()).status,400);assert.equal((await call('/overview?period=2026-09')).data.expenses.length,1);
  assert.equal((await call('/overview?period=2026-09',null,other)).data.expenses.length,0);
  assert.equal((await call('/cash',{kind:'income',date:'2026-09-03',label:'נוסף',amount:12})).status,200);
  assert.equal((await call(path+'/undo',{})).status,200);assert.equal((await pool.query('SELECT * FROM expenses')).rows.length,0);assert.equal((await pool.query('SELECT * FROM incomes')).rows.length,1);
  const q=await preview();await call('/imports/'+q.data.id+'/commit',{selected:['0','1']});await pool.query('UPDATE expenses SET amount=42');
  assert.equal((await call('/imports/'+q.data.id+'/undo',{})).status,409);assert.equal((await pool.query('SELECT * FROM incomes')).rows.length,2);
 }finally{await new Promise(r=>server.close(r));await db.close();}
});
