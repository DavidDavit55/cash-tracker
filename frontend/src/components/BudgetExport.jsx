import {useRef,useState} from 'react';
import {budgetPdf,collectBudgetExport} from '../lib/budgetExport';

export default function BudgetExport({apiClient}){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const [from,setFrom]=useState(today.slice(0,7)+'-01'),[to,setTo]=useState(today),[kind,setKind]=useState('all'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const lock=useRef(false);
 async function download(event){
  event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setMessage('מכין את כל התנועות בטווח שבחרת…');
  try{
   const rows=await collectBudgetExport(apiClient,from,to,kind);
   if(!rows.length){setMessage('לא נמצאו תנועות בטווח ובסוג שבחרת.');return;}
   await document.fonts.ready;
   const blob=budgetPdf(rows,{from,to,kind}),url=URL.createObjectURL(blob),anchor=document.createElement('a');
   anchor.href=url;anchor.download=`NETWORTH-${kind}-${from}-${to}.pdf`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   setMessage(`הוכן PDF עם ${rows.length} תנועות. אפשר להדפיס ולסמן ליד כל תנועה.`);
  }catch(error){setMessage(error.response?.data?.error||error.message||'הייצוא נכשל. לא נוצר דוח חלקי; אפשר לנסות שוב.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <section className="bw-panel" aria-label="ייצוא תנועות תקציב"><h2>ייצוא תנועות ל־PDF</h2><p>הכנסות והוצאות לפי תאריכים, עם סיכומים ומקום לסימון ולהערות בהדפסה.</p><form onSubmit={download}><div className="bw-form"><label>מתאריך<input required type="date" value={from} disabled={busy} onChange={e=>setFrom(e.target.value)}/></label><label>עד תאריך<input required type="date" min={from||undefined} value={to} disabled={busy} onChange={e=>setTo(e.target.value)}/></label><label>סוג התנועות<select value={kind} disabled={busy} onChange={e=>setKind(e.target.value)}><option value="all">הכנסות והוצאות</option><option value="income">הכנסות בלבד</option><option value="expense">הוצאות בלבד</option></select></label><button type="submit" disabled={busy}>{busy?'מכין PDF…':'הורדת PDF'}</button></div></form><small>כולל את כל התנועות שנשמרו בתקציב בטווח הנבחר, כולל יום ההתחלה והסיום. הייצוא אינו משנה נתונים.</small>{message&&<p role="status" className="bw-message">{message}</p>}</section>;
}
