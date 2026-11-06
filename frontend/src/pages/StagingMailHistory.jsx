import React,{useEffect,useState} from 'react';
import api from '../api/client';
import StagingMailViewer from './StagingMailViewer.jsx';
export default function StagingMailHistory({clientId}){
 const [rows,setRows]=useState([]),[error,setError]=useState('');
 useEffect(()=>{api.get('/staging/mail/history',{params:{clientId}}).then(({data})=>setRows(data.rows)).catch(()=>setError('טעינת המיילים שנשלחו נכשלה.'));},[clientId]);
 async function download(key){try{const {data}=await api.get('/staging/mail/eml/'+key,{responseType:'blob'}),url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download='networth-email.eml';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setError('הורדת המייל נכשלה.');}}
 return <section className="wf-panel"><h2>מיילים יוצאים — שליחות בדיקה</h2>{error&&<p role="alert">{error}</p>}{!rows.length&&<p>אין מיילים שמורים בפורמט EML עדיין. שליחות קודמות לגרסה זו אינן משוחזרות אוטומטית.</p>}{rows.map(r=><div className="wf-list-row" key={r.send_key}><div><b>{r.subject}</b><p>נמען מיועד: {r.intended||'לא תועד'} · בפועל: davidsdreams55@gmail.com</p><p>{r.status==='sent'?'נשלח · '+new Date(r.sent_at).toLocaleString('he-IL'):'ממתין לאימות — אין לשלוח שוב'}</p></div>{r.status==='sent'&&<StagingMailViewer id={r.send_key} kind="sent"/>}{r.status==='sent'&&<button onClick={()=>download(r.send_key)}>הורדת המייל EML</button>}</div>)}</section>;
}
