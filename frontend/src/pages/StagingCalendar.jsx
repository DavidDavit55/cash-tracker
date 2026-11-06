import React,{useEffect,useRef,useState} from 'react';
import api from '../api/client';
import {appointmentName} from '../../../.local-preview/appointment-names.js';
import {appointmentSyncVersion} from '../../../.local-preview/appointment-edit.js';
import {retryDelay,retryableCalendarError,pendingCalendar} from '../lib/calendarRetry.js';

export default function StagingCalendar({clients=[],newAppointments=[],saving=false}){
 const [status,setStatus]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[results,setResults]=useState({});
 const dialog=useRef(null);
 async function refresh(){try{const {data}=await api.get('/staging/calendar');setStatus(data);}catch(e){setError(e.response?.data?.error||'לא ניתן לבדוק את חיבור היומן.');}}
 useEffect(()=>{refresh();const params=new URLSearchParams(location.search);if(params.get('calendar')==='failed')setError('החיבור לא הושלם. יש לבחור daviddavit55@gmail.com ולאשר גישה ליומן הבדיקות.');},[]);
 const attempted=useRef(new Set()),inflight=useRef(new Set());
 const retries=useRef(new Map()),latest=useRef({clients,saving});latest.current={clients,saving};
 const timers=useRef(new Set());
 useEffect(()=>()=>{for(const timer of timers.current)clearTimeout(timer);},[]);
 function scheduleRetry(client,appointment,error){
  const key=JSON.stringify([client.id,appointment.id]),version=appointmentSyncVersion(client,appointment),attempt=retries.current.get(key+version)||0;
  const delay=retryableCalendarError(error)?retryDelay(attempt):null;if(delay===null)return;
  retries.current.set(key+version,attempt+1);
  const run=()=>{timers.current.delete(timer);if(latest.current.saving){timer=setTimeout(run,1000);timers.current.add(timer);return;}
   const c=latest.current.clients.find(c=>c.id===client.id),a=c?.appointments?.find(a=>a.id===appointment.id);
   if(a&&!a.done&&retries.current.has(key+version)&&appointmentSyncVersion(c,a)===version)sync(c,a);
  };let timer=setTimeout(run,delay);timers.current.add(timer);
 }
 async function sync(client,appointment){
  const key=JSON.stringify([client.id,appointment.id]),version=appointmentSyncVersion(client,appointment);
  if(inflight.current.has(key))return;
  inflight.current.add(key);attempted.current.add(key+version);pendingCalendar(key,true);
  setResults(v=>({...v,[key]:{loading:true,sourceVersion:version}}));
  try{
   const {data}=await api.post('/staging/calendar/events',{clientId:client.id,appointmentId:appointment.id,expectedVersion:version},{timeout:25000});
   pendingCalendar(key,false);retries.current.delete(key+version);
   setResults(v=>({...v,[key]:{...data,sourceVersion:version}}));
   setStatus(v=>({...v,events:[...(v.events||[]).filter(e=>e.appointment_key!==key),{appointment_key:key,event_url:data.url||'',source_version:version,sync_status:data.cancelled?'cancelled':'active'}]}));
  }catch(e){
   setResults(v=>({...v,[key]:{sourceVersion:version,error:e.response?.data?.error||'האירוע לא נשמר ביומן. נסה שוב.'}}));
   scheduleRetry(client,appointment,e);
  }finally{inflight.current.delete(key);}
 }
 useEffect(()=>{if(!status?.ready||saving)return;for(const client of clients)for(const a of client.appointments||[]){if(a.done)continue;const key=JSON.stringify([client.id,a.id]),version=appointmentSyncVersion(client,a),saved=status.events?.find(e=>e.appointment_key===key);if(saved?.source_version===version||inflight.current.has(key)||attempted.current.has(key+version))continue;if(saved||pendingCalendar(key)||a.updatedAt||a.cancelled||a.annualService||newAppointments.some(x=>x.clientId===client.id&&x.appointmentId===a.id))sync(client,a);}},[newAppointments,clients,status,saving,results]);
 async function connect(){setBusy(true);setError('');try{const {data}=await api.post('/staging/calendar/connect');window.location.assign(data.url);}catch(e){setError(e.response?.data?.error||'פתיחת חיבור גוגל נכשלה.');setBusy(false);}}
 async function setup(){setBusy(true);setError('');try{await api.post('/staging/calendar/setup');await refresh();}catch(e){setError(e.response?.data?.error||'יצירת היומן לא אושרה. בדוק את החיבור לפני ניסיון נוסף.');await refresh();}finally{setBusy(false);}}
 const appointments=clients.flatMap(c=>(c.appointments||[]).filter(a=>!a.done).map(a=>({client:c,appointment:a,key:JSON.stringify([c.id,a.id])})));
 const failed=!!error||Object.values(results).some(r=>r.error),syncing=Object.values(results).some(r=>r.loading);
 return <><button className={'staging-calendar-trigger'+(failed?' needs-attention':'')} onClick={()=>dialog.current.showModal()}><span aria-hidden="true">{failed?'!':status?.ready?'●':'○'}</span> {failed?'יומן — נדרש טיפול':syncing?'שומר ביומן…':status?.ready?'יומן מחובר':'חיבור יומן'}</button>
 <dialog className="staging-calendar-dialog" ref={dialog} dir="rtl" aria-labelledby="calendar-title">
  <header><h2 id="calendar-title">יומן הבדיקות</h2><button aria-label="סגירה" onClick={()=>dialog.current.close()}>×</button></header>
  <p style={{margin:'8px 0'}}>חשבון אישי: daviddavit55@gmail.com · יומן נפרד: NETWORTH בדיקות · פגישה של 30 דקות, לפי שעון ישראל. ללא זימון או מייל למשתתפים.</p>
  {error&&<p role="alert">{error}</p>}
  <button disabled={busy||saving} onClick={connect}>{status?.connected?'חיבור מחדש ליומן Google':'חיבור היומן האישי בגוגל'}</button>
  {status?.connected&&<p>חיבור מחדש מחדש את ההרשאה בלבד. היומן והאירועים הקיימים נשמרים.</p>}
  {status?.connected&&!status.ready&&!status.uncertain&&<button disabled={busy||saving} onClick={setup}>יצירת יומן NETWORTH בדיקות בחשבון האישי</button>}
  {status?.uncertain&&<p role="alert">התקבלה תוצאה לא ודאית בעת יצירת היומן. יש לבדוק בחשבון גוגל; לא ניצור יומן נוסף אוטומטית.</p>}
  {status?.ready&&<><p>פגישות חדשות, עריכות וביטולים מסונכרנים אחרי שמירה בשרת. עריכה מעדכנת את אותו אירוע. פגישות קודמות אפשר להוסיף כאן.</p>
   <details open><summary>פגישות ותיעוד השמירה בגוגל ({appointments.length})</summary>
    {appointments.map(({client,appointment:a,key})=>{const saved=status.events?.find(e=>e.appointment_key===key),r=results[key]||{},version=appointmentSyncVersion(client,a),synced=saved?.source_version===version,url=saved?.event_url;return <div key={key} style={{padding:'10px 0',borderBottom:'1px solid #dbe2db'}}><span>{client.name} · {appointmentName(a.title)} · {a.when?.replace('T',' ')} · </span>{a.cancelled?<span>{synced?'בוטל גם ביומן גוגל':'בוטל בתיק — ממתין לביטול בגוגל'}</span>:synced&&url?<a href={url} target="_blank" rel="noreferrer">נשמר בגוגל — פתיחת האירוע</a>:<span>ממתין לסנכרון</span>}{(!synced||r.error)&&<button disabled={saving||r.loading} onClick={()=>sync(client,a)}>{r.loading?'מסנכרן…':r.error?'ניסיון סנכרון חוזר':a.cancelled?'סנכרון הביטול':saved?'עדכון האירוע בגוגל':'הוספת הפגישה ליומן גוגל'}</button>}{r.error&&<p role="alert">{r.error}</p>}</div>;})}
   </details></>}
 </dialog></>;
}
