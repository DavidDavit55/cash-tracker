import {Router} from 'express';
import {amount,date} from '../services/budgetLedger.js';
import {bankClasses,projectBank,rememberBank} from '../services/budgetBank.js';
const bad=(message,status=400)=>Object.assign(new Error(message),{status});
export function budgetEditing(pool){
 const router=Router();
 router.get('/bank',async(req,res)=>{
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.period||''))return res.status(400).json({error:'חודש לא תקין'});
  const {rows}=await pool.query(`SELECT *,to_char(movement_date,'YYYY-MM-DD') AS date FROM budget_bank_movements WHERE user_id=$1 AND movement_date >= $2::date AND movement_date < $2::date+interval '1 month' ORDER BY movement_date DESC`,[req.user.id,req.query.period+'-01']);res.json(rows);
 });
 router.get('/bank-rules',async(req,res)=>res.json((await pool.query('SELECT * FROM budget_bank_rules WHERE user_id=$1 ORDER BY label_key',[req.user.id])).rows));
 router.post('/bank-rules/remove',async(req,res)=>{await pool.query('DELETE FROM budget_bank_rules WHERE user_id=$1 AND source=$2 AND label_key=$3 AND original_kind=$4',[req.user.id,'discount',req.body.label_key,req.body.original_kind]);res.json({removed:true});});
 async function update(req,res,bank){
  const db=await pool.connect();try{
   await db.query('BEGIN');await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[req.user.id]);
   const input=req.body,value=amount(input.amount),dt=date(input.date);
   if(value===null||Math.abs(value)<0.01||Math.abs(value)>=100000000||!dt||typeof input.label!=='string'||input.label.length>250)throw bad('יש למלא תאריך וסכום תקינים');
   if((bank?input.classification:req.params.kind)==='expense'&&!input.label.trim())throw bad('יש למלא למי שילמת — שם החנות, העסק או מקבל התשלום');
   if(input.category_id&&!(await db.query('SELECT id FROM categories WHERE id=$1 AND user_id=$2',[input.category_id,req.user.id])).rowCount)throw bad('קטגוריה לא שייכת לחשבון');
   if(bank){
    const original=(await db.query('SELECT * FROM budget_bank_movements WHERE id=$1 AND user_id=$2 FOR UPDATE',[req.params.id,req.user.id])).rows[0];if(!original)throw bad('תנועה לא נמצאה',404);
    if(new Date(original.updated_at).getTime()!==new Date(input.updated_at).getTime())throw bad('התנועה השתנתה. יש לרענן לפני השמירה',409);
    if(!bankClasses.includes(input.classification)||value<=0)throw bad('סיווג או סכום לא תקינים');
    const row={...original,amount:value,label:input.label.trim(),date:dt};
    const ledger=await projectBank(db,req.user.id,row,input.classification,input.category_id||null);
    await db.query('UPDATE budget_bank_movements SET amount=$1,label=$2,movement_date=$3,classification=$4,ledger_id=$5,ledger_kind=$6,category_id=$7,updated_at=now() WHERE id=$8 AND user_id=$9',[value,row.label,dt,input.classification,ledger?.id||null,ledger?input.classification:null,input.category_id||null,row.id,req.user.id]);
    if(input.remember)await rememberBank(db,req.user.id,row,input.classification);
   }else{
    if(!['expense','income'].includes(req.params.kind)||req.params.kind==='income'&&value<=0)throw bad('סוג או סכום לא תקינים');
    const table=req.params.kind==='expense'?'expenses':'incomes';
    const original=(await db.query(`SELECT * FROM ${table} WHERE id=$1 AND user_id=$2 FOR UPDATE`,[req.params.id,req.user.id])).rows[0];if(!original)throw bad('תנועה לא נמצאה',404);
    if(new Date(original.updated_at).getTime()!==new Date(input.updated_at).getTime())throw bad('התנועה השתנתה. יש לרענן לפני השמירה',409);
    if((await db.query('SELECT id FROM budget_bank_movements WHERE ledger_id=$1 AND user_id=$2',[req.params.id,req.user.id])).rowCount)throw bad('יש לערוך תנועה זו דרך סיווג תנועות הבנק',409);
    if(table==='expenses')await db.query('UPDATE expenses SET amount=$1,merchant=$2,expense_date=$3,category_id=$4,updated_at=now() WHERE id=$5 AND user_id=$6',[value,input.label.trim(),dt,input.category_id||null,req.params.id,req.user.id]);
    else {if(input.source!==undefined&&(typeof input.source!=='string'||!input.source.trim()||input.source.length>100))throw bad('קטגוריית הכנסה לא תקינה');if(input.includes_vat!==undefined&&typeof input.includes_vat!=='boolean')throw bad('סימון מע״מ לא תקין');await db.query('UPDATE incomes SET amount=$1,description=$2,income_date=$3,source=$6,includes_vat=$7,updated_at=now() WHERE id=$4 AND user_id=$5',[value,input.label.trim(),dt,req.params.id,req.user.id,input.source?.trim()||original.source,input.includes_vat??original.includes_vat]);}
   }
   await db.query('COMMIT');res.json({saved:true});
  }catch(e){await db.query('ROLLBACK');res.status(e.status||500).json({error:e.status?e.message:'לא ניתן לשמור כרגע'});}finally{db.release();}
 }
 router.patch('/bank/:id',(req,res)=>update(req,res,true));
 router.patch('/movements/:kind/:id',(req,res)=>update(req,res,false));
 return router;
}
