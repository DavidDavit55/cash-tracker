import assert from 'node:assert/strict';
import {exportMonths,collectBudgetExport,exportTotals,budgetPdf} from './src/lib/budgetExport.js';
assert.deepEqual(exportMonths('2025-12-31','2026-01-01'),['2025-12','2026-01']);
assert.throws(()=>exportMonths('2026-02-30','2026-03-01'));
assert.throws(()=>exportMonths('2026-10-31','2026-10-01'));
const calls=[];
const api={get:async url=>{calls.push(url);return {data:{expenses:[{id:1,expense_date:'2026-09-30',merchant:'חנות',amount:'20.25'},{id:2,expense_date:'2026-10-01',amount:'-5'},{id:3,expense_date:'2026-10-02',amount:'999'}],incomes:[{id:1,income_date:'2026-10-01',amount:'100.50',source:'משכורת'}]}};}};
const rows=await collectBudgetExport(api,'2026-09-30','2026-10-01');
assert.equal(calls.length,2);assert.equal(rows.length,3);
assert.deepEqual(exportTotals(rows),{income:100.5,expense:15.25,balance:85.25});
assert.equal((await collectBudgetExport(api,'2026-09-30','2026-10-01','income')).length,1);
assert.equal((await collectBudgetExport(api,'2026-11-01','2026-11-02')).length,0);
await assert.rejects(()=>collectBudgetExport({get:async()=>{throw Error('network');}},'2026-10-01','2026-10-02'));
await assert.rejects(()=>collectBudgetExport({get:async()=>({data:{}})},'2026-10-01','2026-10-02'));
console.log('PASS: dates, inclusive boundaries, month collection, deduplication, income filter, refunds, totals, empty and failed requests');
if(process.env.PDF_QA_CANVAS){
 const {createCanvas}=await import(process.env.PDF_QA_CANVAS);
 const {mkdir,writeFile}=await import('node:fs/promises');
 const example=Array.from({length:48},(_,i)=>({date:'2026-10-'+String(i%12+1).padStart(2,'0'),type:i%5?'expense':'income',amount:i%5?134.5:18500,label:i%3?'רכישה בסופרמרקט - קניות לבית':'תיאור ארוך לבדיקת גלישת טקסט ומעבר שורה בעברית עם English 123 - תשלום בכרטיס אשראי',category:'דיור וחשבונות',payment:'כרטיס אשראי'}));
 const pdf=budgetPdf(example,{from:'2026-10-01',to:'2026-10-31'},()=>createCanvas(1,1));
 await mkdir('../tmp/pdfs',{recursive:true});await writeFile('../tmp/pdfs/budget-export-qa.pdf',Buffer.from(await pdf.arrayBuffer()));
 console.log('PDF QA generated');
}
