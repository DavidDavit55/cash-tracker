import React, {useState} from 'react';
import {showInsuranceAmount} from '../frontend/src/lib/insuranceDisplay.js';
const money=n=>n==null?'לא דווח':n.toLocaleString('he-IL',{style:'currency',currency:'ILS'});
export function ProductManagement({product:p}) {
  const [draft,setDraft]=useState({status:'לבדיקה',note:''});
  const [saved,setSaved]=useState(null);
  return <details className="nw-management"><summary>ניהול מוצר · מקורות ומעקב</summary><h5>נתוני המקור לפי תאריך</h5>
    {p.snapshots?.map((s,i)=><section className="nw-snapshot" key={`${s.reportId}-${i}`}><strong>{s.source==='maslaka'?'מסלקה':'הר הביטוח'} · {s.date.split('-').reverse().join('.')}</strong><dl>
      {s.product.monthlyPremium!=null&&<div><dt>פרמיה חודשית</dt><dd>{money(s.product.monthlyPremium)}</dd></div>}
      {s.product.balance!=null&&<div><dt>צבירה</dt><dd>{money(s.product.balance)}</dd></div>}
      {showInsuranceAmount(s.product)&&s.product.coverage>0&&<div><dt>סכום ביטוח במקור זה</dt><dd>{money(s.product.coverage)}</dd></div>}</dl>
      {s.product.coverageItems?.length>0&&<ul>{s.product.coverageItems.map((c,j)=><li key={j}>{c}</li>)}</ul>}</section>)}
    <h5>מעקב טיפול — התנסות מקומית</h5><p>מצב טיפול אינו אישור שהפוליסה פעילה או שהמעבר הושלם. החלפת תצוגה או רענון מוחקים את ההתנסות.</p>
    <label>מצב טיפול<select aria-label="מצב טיפול" value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{['לבדיקה','ממתין למסמך','במעקב'].map(s=><option key={s}>{s}</option>)}</select></label>
    <label>הערת טיפול<textarea value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/></label><button onClick={()=>setSaved({...draft})}>שמירת התנסות</button>
    {saved&&<p role="status">נשמר בהתנסות בלבד: {saved.status}{saved.note?` — ${saved.note}`:''}</p>}</details>;
}
