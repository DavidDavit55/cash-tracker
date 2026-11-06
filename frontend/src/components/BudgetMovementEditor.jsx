import BudgetAmount from './BudgetAmount';
import BudgetIncomeFields from './BudgetIncomeFields';
import {useState} from 'react';
import {bankLabels,bankHelp} from '../lib/budgetBank';
export default function BudgetMovementEditor({movement,categories,busy,onSave,onCancel}){
 const [form,setForm]=useState({source:movement.source||'אחר',includes_vat:!!movement.includes_vat,amount:movement.amount,date:movement.date,label:movement.label,category_id:movement.category_id||'',classification:movement.classification||movement.kind,remember:false,updated_at:movement.updated_at});
 const bank=movement.bank===true;
 return <form className="bw-panel" aria-label="עריכת תנועה" onSubmit={e=>{e.preventDefault();onSave(form);}}>
  <h2>{bank?'עריכה וסיווג של תנועת בנק':'עריכת תנועה'}</h2>
  <fieldset disabled={busy} className="bw-form bw-editor-fields">
   <label>{(bank?form.classification:movement.kind)==='expense'?'הוצאה':'תיאור (לא חובה)'}<input required={(bank?form.classification:movement.kind)==='expense'} placeholder={(bank?form.classification:movement.kind)==='expense'?'שם החנות, העסק או מקבל התשלום':undefined} maxLength={250} value={form.label} onChange={e=>setForm({...form,label:e.target.value})}/></label>
   <label>תאריך<input required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
   <label>סכום<BudgetAmount value={form.amount} positive={bank||movement.kind==='income'} onChange={amount=>setForm({...form,amount})}/></label>
   {bank&&<label>סיווג בתקציב<select value={form.classification} onChange={e=>setForm({...form,classification:e.target.value,remember:false})}>{Object.entries(bankLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
   {(bank?form.classification==='expense':movement.kind==='expense')&&<label>קטגוריה<select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}><option value="">ללא קטגוריה</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
   {!bank&&movement.kind==='income'&&<BudgetIncomeFields form={form} onChange={setForm}/>}
  </fieldset>
  {bank&&<><p>{bankHelp[form.classification]}</p><label className="bw-check"><input type="checkbox" disabled={busy||form.classification==='review'} checked={form.remember} onChange={e=>setForm({...form,remember:e.target.checked})}/>זכור סיווג לתיאור המקורי ולכיוון תנועה זהים בייבואים הבאים</label><small>תיאור מקורי בבנק: {movement.source_label}</small></>}
  <div className="bw-actions"><button disabled={busy}>{busy?'שומר…':'שמירת השינויים'}</button><button type="button" className="bw-secondary" disabled={busy} onClick={onCancel}>ביטול עריכה</button></div>
 </form>;
}
