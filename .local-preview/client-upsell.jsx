import React,{useState} from 'react';
import {clientUpsell,completeClientUpsell} from './client-upsell.js';

export default function ClientUpsell({client,onSave}){
 const [error,setError]=useState('');
 const task=clientUpsell(client);
 return <>
 {task&&<form className="wf-panel" onSubmit={e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));try{onSave(c=>completeClientUpsell(c,data,task.completionTokens));setError('');}catch(err){setError(err.message);}}}>
  <h2>{task.title}</h2><p>מועד: {task.due} · משימה אחת לכל התיק, לאחר סיום המהלכים שסוכמו.</p>
  <p>בודקים צרכים נוספים שלא טופלו. אין הצעה אוטומטית למוצר שסורב או שכבר טופל, ואין שליחת הודעה מהמסך הזה.</p>
  {task.subjects.length>0&&<p>נושאים שלא נדונו: {task.subjects.join(' · ')}</p>}
  <label className="wf-field"><span>תוצאת הבדיקה</span><select name="outcome" required defaultValue=""><option value="" disabled>בחירת תוצאה</option>{['נבדקו צרכים נוספים','הלקוח לא מעוניין','אין צורך בהצעה נוספת'].map(x=><option key={x}>{x}</option>)}</select></label>
  <label className="wf-field"><span>תיעוד השיחה או הבדיקה שבוצעה</span><textarea name="note" required maxLength={2000}/></label>
  <button>שמירת תוצאה וסיום משימת האפסייל</button>{error&&<p role="alert">{error}</p>}
 </form>}
 {(client.upsellHistory||[]).length>0&&<details className="wf-panel"><summary>שיחות אפסייל שהושלמו</summary>{client.upsellHistory.map((h,i)=><article key={i}><strong>{h.outcome}</strong><p>{h.at} · {h.note}</p></article>)}</details>}
 </>;
}
