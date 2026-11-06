import React,{useState,useEffect} from 'react';
import api from '../api/client';
import {reportEmail} from '../../../.local-preview/meeting-context.js';
export default function StagingSummaryMail({client,disabled,onSend}){
 const [connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{api.get('/staging/mail').then(({data})=>setConnected(data.connected)).catch(()=>setError('לא ניתן לבדוק את חיבור המייל.'));},[]);
 async function run(){setBusy(true);setError('');try{if(!connected){const {data}=await api.post('/staging/mail/connect');location.assign(data.url);}else await onSend();}catch(e){setError(e.response?.data?.error||e.message||'השליחה לא הושלמה');}finally{setBusy(false);}}
 const sent=client.summaryDelivery?.summary===client.summary;
 return <section><p>כתובת הלקוח שנקלטה מהמסלקה: <b dir="auto">{reportEmail(client)}</b><br/>נמען בפועל בסטייגינג: <b>davidsdreams55@gmail.com</b> · שולח: david@davit-fin.co.il · ללא עותק ללקוח</p>
 {!connected&&<p>נדרשת הרשאת שליחה בחשבון העסקי. חיבור היומן האישי נשאר ללא שינוי.</p>}
 <button disabled={busy||(connected&&(disabled||sent))} onClick={run}>{busy?'ממתין…':!connected?'חיבור המייל העסקי לשליחת בדיקה':sent?'הסיכום נשלח לכתובת הבדיקה':'שליחת הסיכום למייל הבדיקה'}</button>
 {error&&<p role="alert">{error}</p>}{sent&&<p>Google אישר את השליחה. נמען: davidsdreams55@gmail.com</p>}</section>;
}
