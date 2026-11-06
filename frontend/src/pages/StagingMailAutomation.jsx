import React,{useEffect,useState} from 'react';
import api from '../api/client';
export default function StagingMailAutomation({clientId,onOpen}){
 const [data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;const load=()=>api.get('/staging/mail/automation').then(r=>{if(active){setData(r.data);setError('');}}).catch(()=>{if(active)setError('מצב העיבוד האוטומטי אינו זמין כרגע.');});load();const timer=setInterval(load,15000);return()=>{active=false;clearInterval(timer);};},[]);
 if(!data)return <p role="status">{error||'טוען מצב עיבוד מיילים…'}</p>;
 const rows=data.rows.filter(r=>r.result.status!=='ignored'&&(!clientId||r.result.clientId===clientId));
 const labels={advance:'המשימה קודמה',attach:'המסמך תויק',payroll:'תשובת חשבת השכר נקלטה',exception:'נדרשת בדיקה'};
 return <details><summary>עיבוד אוטומטי: {data.enabled?'פעיל':'טרם הופעל'} · {rows.filter(r=>r.result.status==='exception').length} חריגים</summary>
 <p>קידום מתבצע רק לפי כללי אימות מוגדרים. הודעות שאינן נתמכות נשארות לבדיקה. אין שליחה ללקוח או למעסיק.</p>
 {error&&<p role="alert">{error}</p>}{rows.map(({result:r,created_at})=><article className="wf-mail" key={r.key}><b>{labels[r.status]}</b><p>{r.reason}</p><small>{new Date(created_at).toLocaleString('he-IL')} · מייל {r.mailId}</small>{r.clientId&&onOpen&&<button type="button" className="secondary" onClick={()=>onOpen(r.clientId)}>לפתיחת התיק</button>}</article>)}
 {data.reports?.some(r=>['uncertain','sending'].includes(r.status))&&<p role="alert">יש דוח מייל ששליחתו אינה ודאית. לא נשלח אותו שוב כדי למנוע כפילות.</p>}
 </details>;
}
