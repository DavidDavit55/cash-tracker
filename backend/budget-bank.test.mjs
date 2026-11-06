import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import XLSX from 'xlsx';
import {localDatabase} from './budget-test-db.mjs';
import {createBudgetWorkspaceRouter} from './src/routes/budgetWorkspace.js';
test('bank classification, learning, isolation, editing, source dedup and undo',async()=>{
 const {db,pool}=await localDatabase(),u='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 await pool.query("INSERT INTO users(id,email,password_hash,name) VALUES($1,'one@test','x','one'),($2,'two@test','x','two')",[u,other]);
 const app=express();app.use(express.json());app.use(createBudgetWorkspaceRouter(pool,(req,res,next)=>{req.user={id:req.headers['x-user']||u};next();}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const call=async(path,body,method='POST',user=u)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}`+path,{method:body===undefined?'GET':method,headers:{'x-user':user,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 const preview=async(extra=false,user=u)=>{const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([['תאריך','תיאור','זכות/חובה'],['01/09/2026','העברה לבדיקה',-100],['02/09/2026','כאל',-500],['03/09/2026','משכורת',2000],...(extra?[['04/09/2026','העברה לבדיקה',-100]]:[])]),'בנק');const f=new FormData();f.append('source','discount');f.append('file',new Blob([XLSX.write(w,{type:'buffer',bookType:'xlsx'})]),'bank.xlsx');return call('/preview',f,'POST',user);};
 try{
  const p=await preview();assert.equal(p.status,200);assert.equal(p.data.items[0].classification,'review');assert.equal(p.data.items[1].classification,'card_payment');
  const path='/imports/'+p.data.id;
  assert.equal((await call(path+'/commit',{selected:['0','1','2'],decisions:{'0':{classification:'transfer',remember:true}}})).data.imported,3);
  let overview=(await call('/overview?period=2026-09')).data;assert.equal(overview.expenses.length,0);assert.equal(overview.incomes.length,1);assert.equal(overview.bankMovements.length,3);
  assert.equal((await call('/imports')).data[0].count,3);
  const transfer=overview.bankMovements.find(r=>r.classification==='transfer');const body={...transfer,date:transfer.date,classification:'expense',label:'תיאור מתוקן',amount:125};
  assert.equal((await call('/bank/'+transfer.id,body,'PATCH',other)).status,404);
  assert.equal((await call('/bank/'+transfer.id,body,'PATCH')).status,200);
  assert.equal((await call('/bank/'+transfer.id,body,'PATCH')).status,409);
  overview=(await call('/overview?period=2026-09')).data;assert.equal(Number(overview.expenses[0].amount),125);
  const ledger=overview.expenses[0];assert.equal((await call('/movements/expense/'+ledger.id,{...ledger,label:'שינוי עוקף',date:'2026-09-01'},'PATCH')).status,409);
  const next=await preview(true);assert.equal(next.data.items[0].duplicate,true);assert.equal(next.data.items[3].classification,'transfer');
  const foreign=await preview(true,other);assert.equal(foreign.data.items[3].classification,'review');assert.equal(foreign.data.items[0].duplicate,false);
  assert.equal((await call(path+'/undo',{})).status,409);
  const changed=overview.bankMovements.find(r=>r.id===transfer.id);assert.equal((await call('/bank/'+changed.id,{...changed,classification:'review'},'PATCH')).status,200);
  assert.equal((await call('/overview?period=2026-09')).data.expenses.length,0);
  const income=(await call('/overview?period=2026-09')).data.incomes[0];assert.equal(Number(income.amount),2000);
  // Ordinary cash can be edited inline, without changing its source or identity.
  const cash=(await call('/cash',{kind:'expense',amount:20,date:'2026-09-01',label:'cash'})).data;
  const cashRow=(await call('/overview?period=2026-09')).data.expenses.find(r=>r.id===cash.id);
  assert.equal((await call('/movements/expense/'+cash.id,{label:'edited',date:'2026-09-02',amount:30,updated_at:cashRow.updated_at},'PATCH')).status,200);
  const taxable=(await call('/cash',{kind:'income',amount:118,date:'2026-10-01',label:'commission',source:'עמלות ביטוח',includes_vat:true})).data;
  let oct=(await call('/overview?period=2026-10')).data;const taxRow=oct.incomes.find(r=>r.id===taxable.id);
  assert.equal(taxRow.source,'עמלות ביטוח');assert.equal(taxRow.includes_vat,true);
  assert.equal(Number((await call('/overview?period=2026-09')).data.vat.gross),118);
  assert.equal((await call('/movements/income/'+taxable.id,{label:'commission',date:'2026-10-01',amount:118,source:'משלוחים',includes_vat:false,updated_at:taxRow.updated_at},'PATCH')).status,200);
  oct=(await call('/overview?period=2026-10')).data;assert.equal(Number(oct.vat.gross),0);assert.equal(oct.incomes.find(r=>r.id===taxable.id).source,'משלוחים');
  // An unchanged bank batch can be removed together with its ledger projections.
  const otherBatch=await preview(false,other);const op='/imports/'+otherBatch.data.id;await call(op+'/commit',{selected:['0','1','2']},'POST',other);assert.equal((await call(op+'/undo',{},'POST',other)).status,200);
  assert.equal((await call('/bank?period=2026-09',undefined,'GET',other)).data.length,0);
 }finally{await new Promise(r=>server.close(r));await db.close();}
});
