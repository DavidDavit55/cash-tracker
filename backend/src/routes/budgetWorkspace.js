import {Router} from 'express';
import multer from 'multer';
import {createHash} from 'node:crypto';
import pool from '../db/pool.js';
import {authMiddleware} from '../middleware/auth.js';
import {parseBudget,annotateDuplicates,date,amount} from '../services/budgetLedger.js';
import {suggestBank,moneyBank,bankClasses,rememberBank,projectBank} from '../services/budgetBank.js';
import {budgetEditing} from './budgetEditing.js';
export function createBudgetWorkspaceRouter(pool, authMiddleware){
const router=Router();router.use(authMiddleware);router.use(budgetEditing(pool));
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024}});
const fail=(res,e)=>res.status(e.status||500).json({error:e.status&&e.status<500?e.message:'לא ניתן להשלים את הפעולה כרגע'});
const error=(message,status=400)=>Object.assign(new Error(message),{status});
async function existing(db,user){const {rows}=await db.query(`SELECT 'expense' AS kind,to_char(expense_date,'YYYY-MM-DD') AS date,amount,merchant AS label FROM expenses WHERE user_id=$1 AND NOT EXISTS(SELECT 1 FROM budget_bank_movements b WHERE b.ledger_id=expenses.id AND b.user_id=$1) UNION ALL SELECT 'income',to_char(income_date,'YYYY-MM-DD'),amount,description FROM incomes WHERE user_id=$1 AND NOT EXISTS(SELECT 1 FROM budget_bank_movements b WHERE b.ledger_id=incomes.id AND b.user_id=$1) UNION ALL SELECT original_kind,COALESCE(raw_data->>'date',to_char(movement_date,'YYYY-MM-DD')),COALESCE((raw_data->>'amount')::numeric,amount),source_label FROM budget_bank_movements WHERE user_id=$1`,[user]);return rows;}
router.get('/overview',async(req,res)=>{try{
 const period=String(req.query.period||'');if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw error('חודש לא תקין');
 const start=period+'-01';const [e,i,c,b,periods,bank]=await Promise.all([
  pool.query(`SELECT e.*,to_char(e.expense_date,'YYYY-MM-DD') AS expense_date,c.name AS category_name FROM expenses e LEFT JOIN categories c ON c.id=e.category_id WHERE e.user_id=$1 AND expense_date >= $2::date AND expense_date < $2::date+interval '1 month' ORDER BY e.expense_date DESC`,[req.user.id,start]),
  pool.query(`SELECT incomes.*,to_char(income_date,'YYYY-MM-DD') AS income_date FROM incomes WHERE user_id=$1 AND income_date >= $2::date AND income_date < $2::date+interval '1 month' ORDER BY incomes.income_date DESC`,[req.user.id,start]),
  pool.query('SELECT * FROM categories WHERE user_id=$1 ORDER BY name',[req.user.id]),
  pool.query('SELECT * FROM budgets WHERE user_id=$1 AND year=$2 AND month=$3',[req.user.id,Number(period.slice(0,4)),Number(period.slice(5))]),
  pool.query(`SELECT DISTINCT period FROM (SELECT to_char(expense_date,'YYYY-MM') period FROM expenses WHERE user_id=$1 UNION SELECT to_char(income_date,'YYYY-MM') FROM incomes WHERE user_id=$1 UNION SELECT year::text||'-'||lpad(month::text,2,'0') FROM budgets WHERE user_id=$1) p ORDER BY period DESC`,[req.user.id]),pool.query(`SELECT *,to_char(movement_date,'YYYY-MM-DD') AS date FROM budget_bank_movements WHERE user_id=$1 AND movement_date >= $2::date AND movement_date < $2::date+interval '1 month' ORDER BY movement_date DESC`,[req.user.id,start])]);
 const firstMonth=Math.floor((Number(period.slice(5))-1)/2)*2+1;const vatStart=period.slice(0,4)+'-'+String(firstMonth).padStart(2,'0')+'-01';const vat=(await pool.query("SELECT COALESCE(SUM(amount),0) AS gross FROM incomes WHERE user_id=$1 AND includes_vat=true AND income_date >= $2::date AND income_date < $2::date+interval '2 months'",[req.user.id,vatStart])).rows[0];vat.period_label=String(firstMonth).padStart(2,'0')+'–'+String(firstMonth+1).padStart(2,'0')+'/'+period.slice(0,4);
 res.json({vat,bankMovements:bank.rows,expenses:e.rows,incomes:i.rows,categories:c.rows,budgets:b.rows,periods:periods.rows.map(r=>r.period)});
}catch(e){fail(res,e);}});
router.post('/cash',async(req,res)=>{try{
 const {kind,category_id}=req.body,dt=date(req.body.date),value=amount(req.body.amount);
 const label=req.body.label??'';
 const details=req.body.details??'';if(typeof details!=='string'||details.length>1000)throw error('התיאור ארוך מדי');
 if(kind==='expense'&&(typeof label!=='string'||!label.trim()))throw error('יש למלא למי שילמת — שם החנות, העסק או מקבל התשלום');
 if(!['income','expense'].includes(kind)||!dt||value===null||value<=0||typeof label!=='string'||label.length>250)throw error('יש להשלים סוג תנועה, תאריך וסכום חיובי');
 if(kind==='expense'&&category_id&&!(await pool.query('SELECT id FROM categories WHERE id=$1 AND user_id=$2',[category_id,req.user.id])).rowCount)throw error('קטגוריה לא שייכת לחשבון');
 if(req.body.source!==undefined&&(typeof req.body.source!=='string'||!req.body.source.trim()||req.body.source.length>100))throw error('קטגוריית הכנסה לא תקינה');if(req.body.includes_vat!==undefined&&typeof req.body.includes_vat!=='boolean')throw error('סימון מע״מ לא תקין');
 const r=kind==='expense'?await pool.query("INSERT INTO expenses(user_id,category_id,amount,merchant,expense_date,payment_method,description) VALUES($1,$2,$3,$4,$5,'מזומן',$6) RETURNING id",[req.user.id,category_id||null,value,label.trim(),dt,details.trim()||null]):await pool.query("INSERT INTO incomes(user_id,amount,source,description,income_date,payment_method,includes_vat,notes) VALUES($1,$2,$5,$3,$4,'מזומן',$6,$7) RETURNING id",[req.user.id,value,label.trim(),dt,req.body.source?.trim()||'אחר',req.body.includes_vat===true,details.trim()||null]);
 res.json(r.rows[0]);
}catch(e){fail(res,e);}});
router.post('/preview',upload.single('file'),async(req,res)=>{try{
 if(!req.file)throw error('יש לבחור קובץ');
 const hash=createHash('sha256').update(req.file.buffer).digest('hex');
 const prior=await pool.query("SELECT id FROM budget_imports WHERE user_id=$1 AND file_hash=$2 AND status='committed'",[req.user.id,hash]);if(prior.rowCount)throw error('הקובץ הזה כבר יובא. ניתן לראות אותו בהיסטוריית הייבוא');
 let parsed;try{parsed=parseBudget(req.file.buffer,req.body.source);}catch(e){throw error(e.message);}
 const rules=req.body.source==='discount'?(await pool.query('SELECT * FROM budget_bank_rules WHERE user_id=$1',[req.user.id])).rows:[];
 const items=annotateDuplicates(parsed.items.map(r=>req.body.source==='discount'?{...(req.body.mode==='money'?moneyBank(r):suggestBank(r,rules)),include:true}:r),await existing(pool,req.user.id));
 const {rows}=await pool.query("INSERT INTO budget_imports(user_id,source,filename,file_hash,preview) VALUES($1,$2,$3,$4,$5) RETURNING id",[req.user.id,req.body.source,req.file.originalname.slice(0,250),hash,JSON.stringify({items,issues:parsed.issues})]);
 res.json({id:rows[0].id,items,issues:parsed.issues});
}catch(e){fail(res,e);}});
router.get('/imports',async(req,res)=>{try{res.json((await pool.query("SELECT id,source,filename,status,created_at,committed_at,CASE WHEN source='discount' THEN (SELECT count(*) FROM jsonb_array_elements(records) x WHERE x->>'kind'='bank') ELSE jsonb_array_length(records) END AS count FROM budget_imports WHERE user_id=$1 AND status<>'preview' ORDER BY created_at DESC LIMIT 100",[req.user.id])).rows);}catch(e){fail(res,e);}});
router.post('/imports/:id/commit',async(req,res)=>{
 const db=await pool.connect();try{
 await db.query('BEGIN');await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[req.user.id]);
 const batch=(await db.query('SELECT * FROM budget_imports WHERE id=$1 AND user_id=$2 FOR UPDATE',[req.params.id,req.user.id])).rows[0];if(!batch)throw error('ייבוא לא נמצא',404);
 if(batch.status==='committed'){await db.query('COMMIT');return res.json({imported:(batch.source==='discount'?batch.records.filter(r=>r.kind==='bank').length:batch.records.length)});}if(batch.status!=='preview')throw error('יש להעלות את הקובץ מחדש');
 if((await db.query("SELECT id FROM budget_imports WHERE user_id=$1 AND file_hash=$2 AND status='committed'",[req.user.id,batch.file_hash])).rowCount)throw error('הקובץ כבר יובא');
 const selected=req.body.selected;if(!Array.isArray(selected)||selected.length>3000||new Set(selected).size!==selected.length||selected.some(id=>!batch.preview.items.some(r=>r.id===id)))throw error('בחירת תנועות לא תקינה');
 if(!selected.length)throw error('לא נבחרו תנועות');
 const rows=batch.preview.items.filter(r=>selected.includes(r.id));const live=await existing(db,req.user.id);
 const annotated=annotateDuplicates(rows,live);
 if(annotated.some(r=>r.existingCount!==batch.preview.items.find(p=>p.id===r.id).existingCount))throw error('הנתונים השתנו מאז הבדיקה. יש להעלות מחדש כדי לבדוק כפילויות',409);
 const cats=(await db.query('SELECT id,name FROM categories WHERE user_id=$1',[req.user.id])).rows;
 const memory=(await db.query('SELECT merchant,category_id FROM merchant_categories WHERE user_id=$1',[req.user.id])).rows;
 const decisions=req.body.decisions||{};
 const records=[];
 for(const r of rows){
  let saved;
  if(batch.source==='discount'){
   const decision=decisions[r.id]||{},classification=decision.classification||r.classification;
   if(!bankClasses.includes(classification))throw error('יש לבחור סיווג לכל תנועת בנק');
   const category=memory.find(m=>m.merchant===r.label&&cats.some(c=>c.id===m.category_id))?.category_id||cats.find(c=>c.name==='שונות')?.id||null;
   const ledger=await projectBank(db,req.user.id,r,classification,category);
   if(ledger)records.push({kind:classification,row:ledger});
   const bank=(await db.query('INSERT INTO budget_bank_movements(user_id,source_label,original_kind,amount,movement_date,label,classification,ledger_kind,ledger_id,raw_data) VALUES($1,$2,$3,$4,$5,$2,$6,$7,$8,$9) RETURNING *',[req.user.id,r.label,r.kind,r.amount,r.date,classification,ledger?classification:null,ledger?.id||null,JSON.stringify(r)])).rows[0];
   records.push({kind:'bank',row:bank});
   if(decision.remember)await rememberBank(db,req.user.id,r,classification);
   continue;
  }
  if(r.kind==='expense'){
   const category=memory.find(m=>m.merchant===r.label&&cats.some(c=>c.id===m.category_id))?.category_id||cats.find(c=>c.name==='שונות')?.id||null;
   saved=(await db.query('INSERT INTO expenses(user_id,category_id,amount,merchant,description,expense_date,payment_method,card_number) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[req.user.id,category,r.amount,r.label,`ייבוא ${batch.source}`,r.date,r.payment_method,r.card_number])).rows[0];
  }else saved=(await db.query('INSERT INTO incomes(user_id,amount,source,description,income_date,payment_method) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[req.user.id,r.amount,'אחר',r.label,r.date,r.payment_method])).rows[0];
  records.push({kind:r.kind,row:saved});
 }
 await db.query("UPDATE budget_imports SET status='committed',records=$1,committed_at=now() WHERE id=$2",[JSON.stringify(records),batch.id]);
 await db.query('COMMIT');res.json({imported:rows.length});
 }catch(e){await db.query('ROLLBACK');fail(res,e);}finally{db.release();}
});
router.post('/imports/:id/undo',async(req,res)=>{
 const db=await pool.connect();try{
 await db.query('BEGIN');await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[req.user.id]);
 const b=(await db.query('SELECT * FROM budget_imports WHERE id=$1 AND user_id=$2 FOR UPDATE',[req.params.id,req.user.id])).rows[0];if(!b||b.status!=='committed')throw error('אין ייבוא פעיל לביטול');
 for(const record of b.records){const t=record.kind==='bank'?'budget_bank_movements':record.kind==='expense'?'expenses':'incomes';const row=(await db.query(`SELECT * FROM ${t} WHERE id=$1 AND user_id=$2 FOR UPDATE`,[record.row.id,req.user.id])).rows[0];if(!row||JSON.stringify(row)!==JSON.stringify(record.row)){
  // JSONB reorders keys; compare canonical values instead.
  if(!row||Object.keys(row).some(k=>JSON.stringify(row[k])!==JSON.stringify(record.row[k])))throw error('תנועה מהייבוא נערכה או נמחקה. הביטול נעצר כדי לשמור על השינויים שלך',409);
 }await db.query(`DELETE FROM ${t} WHERE id=$1 AND user_id=$2`,[record.row.id,req.user.id]);}
 await db.query("UPDATE budget_imports SET status='undone' WHERE id=$1",[b.id]);await db.query('COMMIT');res.json({undone:true});
 }catch(e){await db.query('ROLLBACK');fail(res,e);}finally{db.release();}
});
router.use((err,req,res,next)=>{if(err instanceof multer.MulterError)return res.status(400).json({error:'הקובץ גדול מדי (עד 10MB) או שההעלאה לא תקינה'});next(err);});
return router;
}
export default createBudgetWorkspaceRouter(pool,authMiddleware);


