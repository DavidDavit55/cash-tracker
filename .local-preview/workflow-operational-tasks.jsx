import TypedDate from './typed-date.jsx';
import React,{useState} from 'react';
import ClaimScanner from '../frontend/src/components/ClaimScanner.jsx';
export default function OperationalTasks({client,productId,onSave}){
 const [error,setError]=useState(''),[kind,setKind]=useState('הוזלת דמי ניהול');
 const tasks=(client.operationalTasks||[]).filter(t=>!productId||t.productId===productId);
 return <section className="wf-operational-tasks"><h3>משימות תפעוליות למוצר</h3>
 {productId&&import.meta.env.VITE_APP_ENV==='staging'&&<ClaimScanner client={client} productId={productId} onSave={onSave}/>}
 {tasks.filter(t=>t.claimScan).map(t=><details key={'scan-'+t.id}><summary>חשבוניות שנבדקו: {t.claimScan.provider} · {t.claimScan.total} ₪ · טרם הוגש</summary><p>נספח {t.claimScan.annex} · {t.claimScan.coverage} · מקור: {t.claimScan.name} (הקובץ לא הועלה לשרת)</p>{t.claimScan.invoices.map(i=><p key={i.page}>עמוד {i.page} · חשבונית {i.invoice} · {i.date} · {i.amount} ₪</p>)}</details>)}
 <p className="wf-muted">רישום ומעקב פנימי. הפרוטוקולים להוזלה, מוטבים, מסלולים ותביעות יוגדרו יחד; פתיחת משימה אינה מבצעת שינוי בחברה.</p>
 {productId&&<form onSubmit={e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget));const task={...v,completionPolicy:v.kind==='משימה אחרת'&&v.allowGoogleCompletion==='on'?'manual_internal':'crm_only',id:crypto.randomUUID(),productId,createdAt:new Date().toISOString(),status:'open',protocolStatus:'pending_spec'};delete task.allowGoogleCompletion;if(onSave([...(client.operationalTasks||[]),task],'נפתחה משימה תפעולית: '+v.kind)){e.currentTarget.reset();setKind('הוזלת דמי ניהול');setError('');}else setError('המשימה לא נשמרה.');}}>
 <div className="wf-fields"><label className="wf-field">סוג משימה<select name="kind" value={kind} onChange={e=>setKind(e.target.value)}>{['הוזלת דמי ניהול','עדכון מוטבים','שינוי מסלולי השקעה','תביעה','משימה אחרת'].map(x=><option key={x}>{x}</option>)}</select></label><label className="wf-field">מועד טיפול<TypedDate name="due" type="date" required/></label></div>
 {kind==='משימה אחרת'&&<label><TypedDate type="checkbox" name="allowGoogleCompletion"/> משימה מנהלית בלבד — אפשר לסגור גם מגוגל. אינה בדיקת מוצר, כספים או אסמכתה.</label>}
 <label className="wf-field">מה צריך לעשות?<TypedDate name="note" maxLength="240" required/></label><button className="secondary">הוספת משימה</button>
 </form>}
 {error&&<p role="alert">{error}</p>}
 {tasks.filter(t=>t.status!=='done').map(t=><div className="wf-list-row" key={t.id}><div><b>{t.kind}</b><p>{t.note}</p><small>{client.products.find(p=>p.id===t.productId)?.name} · {t.due} · פרוטוקול דורש אפיון</small></div><button className="secondary" onClick={()=>onSave(client.operationalTasks.map(x=>x.id===t.id?{...x,status:'done',completedAt:new Date().toISOString()}:x),'נסגרה משימה פנימית: '+t.kind)}>סגירת המשימה הפנימית</button></div>)}
 {!!tasks.filter(t=>t.status==='done').length&&<details><summary>משימות פנימיות שהושלמו ({tasks.filter(t=>t.status==='done').length})</summary>{tasks.filter(t=>t.status==='done').map(t=><p key={t.id}>✓ {t.kind} · {t.note}</p>)}</details>}
 </section>;
}
