import React,{useState} from 'react';
import TypedDate from './typed-date.jsx';
import {israelDate,businessDate} from './workflow-process.js';
import {openingDue,recordOpening} from './pension-flow.js';
import OpeningMail from './opening-mail.jsx';
export default function PensionOpening({d,change,clientId}){
 const [error,setError]=useState('');
 const [policy,setPolicy]=useState(d.policy||''),[evidence,setEvidence]=useState('');
 return <form className="wf-kit" onSubmit={e=>{e.preventDefault();try{change(recordOpening(d,Object.fromEntries(new FormData(e.currentTarget))),'אומתה פתיחת קופת היעד');setError('');}catch(err){setError(err.message);}}}>
 <h3>וידוא פתיחת הקופה וקבלת המסמכים בחברה</h3><p>מועד הבדיקה: {openingDue(d)} — יומיים עסקים מהחתימה. SMS 2010 מעביר את המסמכים אוטומטית; אין שליחה נוספת כאן.</p>
 <OpeningMail d={d} clientId={clientId} change={change} onProposal={(p,e)=>{if(p)setPolicy(p);setEvidence(e);}}/>
 <div className="wf-fields"><label className="wf-field">מספר חשבון בקופת היעד<input name="policy" value={policy} onChange={e=>setPolicy(e.target.value)} required/></label><label className="wf-field">תאריך הבדיקה<TypedDate name="date" type="date" max={israelDate()} required/></label></div>
 <label className="wf-field">מקור האימות לפתיחת הקופה<input name="evidence" value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="אישור חברה או בדיקה באתר החברה" required/></label>
 <p className="wf-muted">לאחר האימות: לקופה פעילה אוספים נספח ו׳ וטופס קוביות להכנת מייל לחשבת השכר. בלא פעילה ממשיכים למעקב ניוד ללא הפקדה.</p>
 <button>הקופה נפתחה — המשך</button> <button type="button" className="secondary" onClick={()=>change({pensionFlow:{...d.pensionFlow,openingRetry:businessDate(israelDate(),2)}},'הקופה טרם נפתחה — מעקב חוזר בעוד יומיים עסקים')}>טרם נפתחה</button>
 {error&&<p role="alert">{error}</p>}</form>;
}
