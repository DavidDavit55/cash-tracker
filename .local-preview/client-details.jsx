import React,{useEffect,useRef,useState} from 'react';
import './client-details.css';

export default function ClientDetailsDialog({client,onClose}) {
 const dialog=useRef(null),[message,setMessage]=useState('');
 useEffect(()=>{dialog.current.showModal();},[]);
 const profile=client.sourceProfile||{},fields=[
  ['שם מלא',profile.name||client.name],['תעודת זהות',client.identity],
  ['טלפון',profile.phone||client.phone],['מייל לקוח',client.email],
  ['תאריך לידה',profile.birth||client.birth],['תאריך הנפקת ת״ז',client.issued],
  ['מקור הליד',client.source],['מקור פרטי הלקוח',profile.source||'פרטי התיק'],
  ['מקור המייל',client.emailSource],['תאריך נתוני המסלקה',profile.asOf]
 ];
 async function copy(){try{await navigator.clipboard.writeText(client.identity);setMessage('תעודת הזהות הועתקה');}catch{setMessage('ההעתקה לא אושרה בדפדפן. אפשר לסמן ולהעתיק את המספר.');}}
 return <dialog ref={dialog} className="wf-dialog wf-client-details" dir="rtl" onCancel={onClose} aria-labelledby="client-details-title">
  <header><h2 id="client-details-title">פרטי הלקוח</h2><button type="button" className="wf-icon" aria-label="סגירת פרטי הלקוח" onClick={onClose}>×</button></header>
  <p className="wf-muted">אותו תיק לקוח, ללא הזנה כפולה. פרטים שלא דווחו אינם מושלמים בניחוש.</p>
  <dl>{fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd><bdi>{value||'לא דווח'}</bdi>{label==='תעודת זהות'&&value&&<button type="button" className="wf-link" onClick={copy}>העתקה</button>}</dd></div>)}</dl>
  {client.sourceProfileHistory?.length>0&&<details><summary>פרטים קודמים לפני עדכון מהמסלקה</summary>{client.sourceProfileHistory.map((p,i)=><p key={i}>{p.name||'שם לא דווח'} · {p.birth||'תאריך לידה לא דווח'} · <bdi>{p.email||'מייל לא דווח'}</bdi> · {p.source}</p>)}</details>}
  {profile.conflicts?.length>0&&<p className="wf-warning">בדוחות נמצאו פרטים שונים: {profile.conflicts.join(' · ')}. יש לבדוק את המקור; לא נבחר ערך אוטומטית.</p>}
  <p role="status" aria-live="polite">{message}</p>
 </dialog>;
}
