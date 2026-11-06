import React,{useEffect,useRef,useState} from 'react';
import api from '../api/client';

export default function StagingTasks({revision,saving,onSync}){
 const [status,setStatus]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState(null);
 const dialog=useRef(null),running=useRef(false),queued=useRef(false);
 async function refresh(){const {data}=await api.get('/staging/tasks');setStatus(data);}
 useEffect(()=>{refresh().catch(()=>setError('בדיקת חיבור המשימות נכשלה.'));const p=new URLSearchParams(location.search);if(p.has('tasks'))dialog.current.showModal();if(p.get('tasks')==='failed')setError('ההרשאה לא הושלמה. יש להתחבר לחשבון האישי ולאשר גישה למשימות.');},[]);
 const syncHandler=useRef(onSync);syncHandler.current=onSync;
 async function sync(){if(running.current){queued.current=true;return;}running.current=true;setBusy(true);setError('');try{do{queued.current=false;const data=syncHandler.current?await syncHandler.current():(await api.post('/staging/tasks/sync')).data;setResult(data);}while(queued.current);}catch(e){setError(e.response?.data?.error||e.message||'הסנכרון נכשל. המשימות שמורות ב-CRM.');}finally{running.current=false;setBusy(false);}}
 useEffect(()=>{if(status?.ready&&!saving)sync();},[status?.ready,revision,saving]);
 async function action(kind){setBusy(true);setError('');try{const {data}=await api.post('/staging/tasks/'+kind);if(kind==='connect')window.location.assign(data.url);else await refresh();}catch(e){setError(e.response?.data?.error||'החיבור לא הושלם.');}finally{setBusy(false);}}
 return <><button className={'staging-calendar-trigger'+(error?' needs-attention':'')} onClick={()=>dialog.current.showModal()}>{error?'משימות — נדרש טיפול':busy?'מסנכרן משימות…':status?.ready?'משימות מחוברות':'חיבור משימות'}</button>
 <dialog ref={dialog} className="staging-calendar-dialog" dir="rtl" aria-labelledby="tasks-title"><header><h2 id="tasks-title">NETWORTH — תפעול</h2><button aria-label="סגירה" onClick={()=>dialog.current.close()}>×</button></header>
 <p>Google Tasks בחשבון daviddavit55@gmail.com. משימות תפעול מתוארכות יוצגו גם ביומן גוגל כמשימות, לא כפגישות. יש לסמן את תצוגת Tasks ביומן.</p>
 <p>הסנכרון מתבצע בפתיחת ה-CRM, לאחר שמירה או בלחיצה כאן. משימה מנהלית מסוג ״משימה אחרת״ שאושרה לכך יכולה להיסגר מגוגל. בדיקות מוצר, כספים, מסמכים ובקשות מידע נסגרות רק ב-CRM; סימון שלהן בגוגל יתאפס. תאריך בלבד, ללא שעה.</p>
 {error&&<p role="alert">{error}</p>}
 <button disabled={busy||saving} onClick={()=>action('connect')}>{status?.connected?'חיבור מחדש ל־Google Tasks':'חיבור Google Tasks האישי'}</button>
 {status?.connected&&<p>חיבור מחדש מחדש את ההרשאה בלבד. רשימת המשימות והשיוכים הקיימים נשמרים.</p>}
 {status?.connected&&!status.ready&&!status.uncertain&&<button disabled={busy||saving} onClick={()=>action('setup')}>יצירת רשימת NETWORTH — תפעול</button>}
 {status?.uncertain&&<p role="alert">יצירת הרשימה לא אושרה בוודאות. נדרש בירור כדי למנוע כפילות.</p>}
 {status?.ready&&<button disabled={busy||saving} onClick={sync}>סנכרון משימות עכשיו</button>}
 {result&&<p role="status">{result.open} משימות פתוחות סונכרנו. {result.imported>0?`${result.imported} משימות מנהליות הושלמו מגוגל ונשמרו בתיק.`:''} {result.undated>0?`${result.undated} ללא תאריך ולכן לא יוצגו ביומן.`:''}</p>}
 </dialog></>;
}
