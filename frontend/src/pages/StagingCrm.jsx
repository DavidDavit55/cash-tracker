import React,{useEffect,useRef,useState} from 'react';
import api from '../api/client';
import WorkflowDemo from '../components/StagingAdminShell.jsx';
import './StagingCrm.css';
import StagingCalendar from './StagingCalendar';
import {pendingCalendar} from '../lib/calendarRetry.js';
import StagingTasks from './StagingTasks';
import {applyTaskCompletions} from '../../../.local-preview/task-sync.js';
import {archiveSourceFile} from '../lib/stagingFiles.js';

export default function StagingCrm(){
 const [state,setState]=useState(null),[status,setStatus]=useState('טוען…'),[error,setError]=useState('');
 const revision=useRef(0),busy=useRef(false),pending=useRef(null),acknowledged=useRef(null);
 const [newAppointments,setNewAppointments]=useState([]);
 const [taskUpdates,setTaskUpdates]=useState(null),taskSyncRunning=useRef(false);
 useEffect(()=>{api.get('/staging/crm',{timeout:15000}).then(({data})=>{revision.current=data.revision;acknowledged.current=data.state;setState(data.state);setStatus('נשמר בשרת הבדיקה');}).catch(()=>setError('טעינת התיק נכשלה. רענן כדי לנסות שוב.'));},[]);
 useEffect(()=>{const guard=e=>{if(pending.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[]);
 const queued=useRef(null),failed=useRef(false),timer=useRef(null);
 function persist(next,onSaved){
  if(failed.current)return false;
  pending.current=next;
  queued.current={state:next,callbacks:[...(queued.current?.callbacks||[]),...(onSaved?[onSaved]:[])]};
  busy.current=true;setStatus('שומר בשרת…');
  clearTimeout(timer.current);timer.current=setTimeout(flush,250);
  return true;
 }
 const sending=useRef(false);
 async function flush(){
  if(sending.current||taskSyncRunning.current||failed.current||!queued.current)return;
  const batch=queued.current;queued.current=null;sending.current=true;
  try{
   const {data}=await api.put('/staging/crm',{revision:revision.current,state:batch.state});
   revision.current=data.revision;
   const previous=new Set((acknowledged.current?.clients||[]).flatMap(c=>(c.appointments||[]).map(a=>JSON.stringify([c.id,a.id]))));
   const added=batch.state.clients.flatMap(c=>(c.appointments||[]).filter(a=>!a.done&&!previous.has(JSON.stringify([c.id,a.id]))).map(a=>({clientId:c.id,appointmentId:a.id})));
   for(const a of added)pendingCalendar(JSON.stringify([a.clientId,a.appointmentId]),true);
   acknowledged.current=batch.state;setState(batch.state);setNewAppointments(old=>[...old,...added]);
   sending.current=false;
   if(!queued.current){pending.current=null;busy.current=false;setStatus('נשמר בשרת הבדיקה · גרסה '+data.revision);}
   for(const callback of batch.callbacks)callback();
   if(queued.current){clearTimeout(timer.current);timer.current=setTimeout(flush,250);}
  }catch(e){sending.current=false;failed.current=true;clearTimeout(timer.current);setError(e.response?.status===409?'התיק השתנה בחלון אחר. הורד את הטיוטה לפני רענון.':'השמירה נכשלה. הורד את הטיוטה לפני רענון.');setStatus('לא נשמר');}
 }
 async function syncTasks(){
  if(taskSyncRunning.current||busy.current||pending.current||sending.current||failed.current)throw Error('יש להמתין לשמירה לפני סנכרון המשימות.');
  taskSyncRunning.current=true;
  try{
   const {data}=await api.post('/staging/tasks/sync',{revision:revision.current});
   if(!Number.isInteger(data.revision))throw Error('לא התקבל אישור גרסה לסנכרון.');
   revision.current=data.revision;
   const updates=data.completionUpdates||[];
   if(updates.length){
    acknowledged.current=applyTaskCompletions(acknowledged.current,updates);
    if(pending.current)pending.current=applyTaskCompletions(pending.current,updates);
    if(queued.current)queued.current={...queued.current,state:applyTaskCompletions(queued.current.state,updates)};
    setState(current=>applyTaskCompletions(current,updates));
    setTaskUpdates({sequence:Date.now(),updates});
   }
   return data;
  }catch(e){
   // A lost response may hide a successful inbound completion. Never overwrite it
   // using an old revision, and never replace a user's in-progress form/draft.
   try{const {data}=await api.get('/staging/crm');if(data.revision!==revision.current){failed.current=true;setError('התיק השתנה בזמן הסנכרון. הורד טיוטה אם קיימת ורענן לפני המשך עבודה.');}}catch{failed.current=true;setError('לא ניתן לוודא את גרסת התיק אחרי הסנכרון. יש לרענן לפני המשך עבודה.');}
   throw e;
  }finally{taskSyncRunning.current=false;if(queued.current&&!failed.current){clearTimeout(timer.current);timer.current=setTimeout(flush,0);}}
 }
 function backup(){const u=URL.createObjectURL(new Blob([JSON.stringify(pending.current)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='staging-unsaved-draft.json';a.click();URL.revokeObjectURL(u);}
 return <div className="staging-crm-view"><div className="staging-toolbar" dir="rtl"><details className="staging-environment"><summary>סביבת בדיקה</summary><nav><a href="/__staging">בחירת חשבון</a><a href="/admin/clients">אדמין</a><a href="/budget">התקציב שלי</a><small>שליחת סיכום לכתובת בדיקה בלבד</small></nav></details><span role="status">{error?'השמירה נכשלה':busy.current?'שומר…':state?'כל השינויים נשמרו':'טוען…'}</span>{state&&<StagingTasks revision={revision.current} saving={busy.current||!!error} onSync={syncTasks}/>}{state&&<StagingCalendar clients={state.clients} newAppointments={newAppointments} saving={busy.current||!!error}/>}</div>{error&&<p className="staging-save-error" role="alert">{error} {pending.current&&<button onClick={backup}>הורדת הטיוטה שלא נשמרה</button>}</p>}{state&&<div inert={error?true:undefined}><WorkflowDemo serverTaskUpdates={taskUpdates} serverArchiveSource={archiveSourceFile} serverSendDelivery={async(clientId,decisionId)=>{if(busy.current||pending.current)throw Error('יש להמתין לשמירה לפני שליחה.');const {data}=await api.post('/staging/mail/delivery',{clientId,decisionId,revision:revision.current});return data;}} serverSendPayroll={async(clientId,decisionId,draft)=>{if(busy.current||pending.current)throw Error('יש להמתין לשמירה לפני שליחה.');const {data}=await api.post('/staging/mail/payroll',{clientId,decisionId,draft,revision:revision.current});return data;}} serverInitial={state} serverPersist={persist} serverSendSummary={async client=>{if(busy.current||pending.current)throw Error('יש להמתין לשמירת הסיכום לפני שליחה.');const {data}=await api.post('/staging/mail/summary',{clientId:client.id,summary:client.summary,revision:revision.current});return data;}}/></div>}</div>;
}
