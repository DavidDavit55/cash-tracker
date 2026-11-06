import TypedDate from './typed-date.jsx';
import React,{useState,useEffect} from 'react';
import {pensionFields,pensionFieldMatches,pensionVerificationReady} from './pension-verification.js';
export default function PensionVerification({d,change}) {
 const [values,setValues]=useState(d.pensionVerification?.values||{});
 useEffect(()=>setValues(d.pensionVerification?.values||{}),[d.id,d.pensionVerification]);
 const fields=pensionFields(d),valid=fields.every(f=>pensionFieldMatches(f,values[f.key]));
 return <form className="wf-kit" aria-label="בדיקת פרטי הפקה בפנסיה" onSubmit={e=>{e.preventDefault();if(valid)change({pensionVerification:{values:{...values},checkedAt:new Date().toISOString()}},'פרטי ההפקה בפנסיה הוזנו ונמצאו תואמים לסיכום');}}>
 <h3>בדיקת פרטי ההפקה מול הסיכום</h3>
 <p>הזן לפי אישור הקרן או אתר החברה. אי־התאמה מחייבת בירור ותיקון לפני סיום התהליך. נתון שלא סוכם מחייב השלמת הסיכום.</p>
 <div className="wf-fields">{fields.map(f=><label className="wf-field" key={f.key}>{f.label}
 <small>{f.date?'תאריך הקליטה כפי שמופיע בחברה':`צפוי: ${f.expected??'לא סוכם'}`}</small>
 <TypedDate aria-label={f.label} required type={f.date?'date':f.numeric?'number':'text'} min={f.numeric?0:undefined} step={f.numeric?'any':undefined} value={values[f.key]??''} onChange={e=>{const next={...values,[f.key]:e.target.value};setValues(next);if(d.pensionVerification?.checkedAt)change({pensionVerification:{values:next,checkedAt:null}},'בדיקת ההפקה נערכה — נדרש אימות מחדש');}}/>
 {values[f.key]!==undefined&&<small>{pensionFieldMatches(f,values[f.key])?'תואם / תקין':'חסר או לא תואם — יש לבדוק'}</small>}
 </label>)}</div>
 <button disabled={!valid}>שמירת בדיקת ההפקה</button>
 {pensionVerificationReady(d)&&<p className="wf-success">פרטי ההפקה נבדקו ונשמרו.</p>}
 </form>;
}
