import React,{useEffect,useRef,useState} from 'react';
import WorkflowDemo from './workflow-demo.jsx';
import {initial} from './workflow-model.js';

export default function ServerWorkspace(){
 const [loaded,setLoaded]=useState(null),[status,setStatus]=useState('loading'),[error,setError]=useState(''),[generation,setGeneration]=useState(0);
 const revision=useRef(0),token=useRef(''),pending=useRef(null),busy=useRef(true);
 async function load(){setStatus('loading');busy.current=true;try{const r=await fetch('/sandbox-store',{headers:{'X-Sandbox-Request':'1'},credentials:'omit'});if(!r.ok)throw Error('השרת המקומי אינו זמין');const v=await r.json();revision.current=v.revision;token.current=v.token;setLoaded(v.state);setStatus(v.state?'saved':'empty');setError('');setGeneration(n=>n+1);pending.current=null;busy.current=false;}catch(e){setError(e.message);setStatus('error');}}
 useEffect(()=>{load();},[]);
 useEffect(()=>{const guard=e=>{if(pending.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[]);
 async function send(next){setStatus('saving');setError('');busy.current=true;pending.current=next;
  try{const r=await fetch('/sandbox-store',{method:'PUT',credentials:'omit',headers:{'Content-Type':'application/json','X-Sandbox-Request':'1','X-Sandbox-Token':token.current},body:JSON.stringify({revision:revision.current,state:next})});const v=await r.json();if(!r.ok){if(r.status===409)setStatus('conflict');throw Error(v.error||'השמירה נכשלה');}revision.current=v.revision;pending.current=null;setLoaded(next);setStatus('saved');busy.current=false;}
  catch(e){setError(e.message);setStatus(s=>s==='conflict'?s:'error');}
 }
 function persist(next){if(busy.current)return false;send(next);return true;}
 function backupDraft(){const url=URL.createObjectURL(new Blob([JSON.stringify(pending.current,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='sandbox-unsaved-draft.json';a.click();URL.revokeObjectURL(url);}
 async function importBackup(file){try{if(!file)return;if(file.size>32*1024*1024)throw Error('הגיבוי גדול מדי');const state=JSON.parse(await file.text());if(!Array.isArray(state.clients))throw Error('קובץ הגיבוי אינו תקין');send(state);}catch(e){setError(e.message);}}
 return <div dir="rtl"><div role="status" style={{position:'sticky',top:0,zIndex:10000,padding:12,background:status==='saved'?'#e7f1eb':'#fff3d6',color:'#163d30',textAlign:'center'}}>
 <b>סנדבוקס שרת מקומי</b> · {status==='saved'?'נשמר במסד המקומי · גרסה '+revision.current:status==='saving'?'שומר… אין לסגור עד לאישור':status==='loading'?'טוען מהשרת…':status==='empty'?'מסד הנתונים ריק':'לא נשמר — הטיוטה נשארה פתוחה'} · אין שליחות חיצוניות
 {error&&<p role="alert">{error}</p>}
 {['error','conflict'].includes(status)&&<div>{pending.current&&<button onClick={backupDraft}>הורדת הטיוטה שלא נשמרה</button>}{status!=='conflict'&&pending.current&&<button onClick={()=>send(pending.current)}>ניסיון שמירה נוסף</button>}<button onClick={()=>{if(!pending.current||window.confirm('לטעון את גרסת השרת? השינוי שלא נשמר יוחלף. ניתן להוריד אותו קודם.'))load();}}>טעינה מחדש מהשרת</button></div>}
 </div>
 {status==='empty'&&<section style={{maxWidth:650,margin:'60px auto',padding:30}}><h1>מתחילים בסנדבוקס המקומי</h1><p>הדמו ב־5208 נשאר ללא שינוי. להעברת תיקיו, לחץ שם על ״הורדת גיבוי הדמו״ ובחר את הקובץ כאן. הייבוא זמין רק כשהמסד ריק.</p><label>ייבוא גיבוי הדמו<input type="file" accept=".json,application/json" onChange={e=>importBackup(e.target.files[0])}/></label><p><button onClick={()=>send(initial())}>התחלה עם מאגר ריק</button></p></section>}
 {loaded&&<div inert={busy.current?true:undefined} style={{pointerEvents:busy.current?'none':undefined,opacity:busy.current ? 0.7 : 1}}><WorkflowDemo key={generation} serverInitial={loaded} serverPersist={persist}/></div>}
 </div>;
}
