import React,{useEffect,useRef,useState} from 'react';
import api from '../api/client';
import StagingAdminShell from '../components/StagingAdminShell.jsx';
import {createCrmPersistence} from '../lib/crmPersistence.js';
import './StagingCrm.css';

const blocked=async()=>{throw Error('שליחה חיצונית אינה מופעלת בסביבת בדיקת המעקב. לא נשלח מייל ולא שונה סטטוס.');};
export default function OperationalCrm({apiClient=api,banner='מעקב תהליכים · חיבורים חיצוניים אינם מופעלים',budgetContent}){
 const [state,setState]=useState(null),[status,setStatus]=useState({}),[error,setError]=useState('');
 const writer=useRef(null);
 useEffect(()=>{
  let active=true;
  apiClient.get('/crm/state').then(({data})=>{
   if(!active)return;
   if(!Number.isInteger(data.revision)||!Array.isArray(data.state?.clients))throw Error('Invalid state');
   writer.current=createCrmPersistence({revision:data.revision,save:async body=>(await apiClient.put('/crm/state',body)).data,onStatus:next=>{
    if(!active)return;setStatus(next);
    if(next.failed)setError(next.error?.response?.status===409?'הנתונים השתנו בחלון אחר. הורד את הטיוטה ורענן; לא דרסנו את השינוי.':'השמירה לא אושרה. הורד את הטיוטה לפני רענון; לא ננסה שוב אוטומטית.');
   }});
   setStatus({revision:data.revision});setState(data.state);
  }).catch(()=>{if(active)setError('לא ניתן לטעון את מעקב התהליכים. בדוק הרשאות וחיבור. לא נטענו נתוני דמו במקום הנתונים שלך.');});
  const guard=e=>{if(writer.current?.pending){e.preventDefault();e.returnValue='';}};
  window.addEventListener('beforeunload',guard);
  return()=>{active=false;window.removeEventListener('beforeunload',guard);};
 },[apiClient]);
 function backup(){
  const url=URL.createObjectURL(new Blob([JSON.stringify({revision:writer.current.revision,state:writer.current.pending})],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='crm-unsaved-draft.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <div className="staging-crm-view" dir="rtl">
  <div className="staging-toolbar"><span role="status">{error?'נדרש טיפול':status.saving?'שומר…':state?'כל השינויים נשמרו · גרסה '+status.revision:'טוען…'}</span></div>
  {error&&<p className="staging-save-error" role="alert">{error} {writer.current?.pending&&<button onClick={backup}>הורדת הטיוטה שלא נשמרה</button>}</p>}
  {state&&<div inert={error?true:undefined}><StagingAdminShell banner={banner} budgetContent={budgetContent} trackingOnly serverInitial={state} serverPersist={(next,done)=>writer.current.persist(next,done)} serverSendSummary={blocked} serverSendPayroll={blocked} serverSendDelivery={blocked}/></div>}
 </div>;
}
