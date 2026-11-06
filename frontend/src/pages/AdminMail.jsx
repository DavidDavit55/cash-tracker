import {useEffect,useState} from 'react';
import {Navigate,Link,useSearchParams} from 'react-router-dom';
import {useAuth} from '../hooks/useAuth';
import api from '../api/client';
import './AdminMail.css';

export default function AdminMail(){
 const {user,loading}=useAuth();
 const [params]=useSearchParams();
 const [status,setStatus]=useState(null),[data,setData]=useState({messages:[],clients:[],hasMore:false});
 const [offset,setOffset]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[choices,setChoices]=useState({});
 const authorized=!!user&&user.email===import.meta.env.VITE_ADMIN_EMAIL;
 const clientId=params.get('clientId');
 const [view,setView]=useState('work');
 async function load(){
  const {data:s}=await api.get('/admin/gmail/status');setStatus(s);
  if(s.configured){const {data:d}=await api.get('/admin/gmail/messages',{params:{offset,view,clientId:clientId||undefined}});setData(d);}
 }
 useEffect(()=>{
  if(!authorized)return;let live=true;
  api.get('/admin/gmail/status').then(async({data:s})=>{
   if(!live)return;setStatus(s);
   if(s.configured){const {data:d}=await api.get('/admin/gmail/messages',{params:{offset,view,clientId:clientId||undefined}});if(live)setData(d);}
  }).catch(()=>{if(live)setError('לא ניתן לטעון את מסך המיילים.');});
  return()=>{live=false;};
 },[authorized,offset,view,clientId]);
 async function action(fn){setBusy(true);setError('');setNotice('');try{await fn();}catch(e){setError(e.response?.data?.error||'הפעולה לא הושלמה. נסה שוב.');}finally{setBusy(false);}}
 if(loading)return <p role="status">טוען...</p>;
 if(!user)return <Navigate to="/login" replace/>;
 if(!authorized)return <Navigate to="/" replace/>;
 return <section className="gmail-page" dir="rtl">
  <header><div><h1>מיילים ולקוחות</h1><p>קריאה בלבד · כל שיוך דורש אישור שלך</p></div><Link to="/admin/clients">ללקוחות</Link></header>
  {error&&<p className="gmail-error" role="alert">{error}</p>}
  {notice&&<p role="status" className="gmail-info">{notice}</p>}
  {params.get('gmail')==='connected'&&<p className="gmail-info">החיבור נשמר. ייבוא מיילים מתחיל רק בלחיצה על כפתור הייבוא.</p>}
  {params.get('gmail')==='failed'&&<p className="gmail-error">האישור מגוגל לא הושלם. ודא שנבחר החשבון שעבורו התחלת את החיבור ונסה שוב.</p>}
  <section className="gmail-panel"><h2>התיבות שלך</h2>
   {!status?<p>בודק את החיבור...</p>:!status.configured?<p>החיבור עדיין לא הוגדר בשרת. לא נקראים מיילים. יש להשלים כתובת חזרה ומפתח הצפנה לפני החיבור.</p>:status.accounts.map(({email,connection})=><article className="gmail-message" key={email}>
    <h3><bdi>{email}</bdi></h3>
    <p>{connection?`מחובר: ${connection.email}`:'אין חשבון מחובר'}</p>
    <p>סנכרון מלא אחרון: {connection?.last_sync_at?new Date(connection.last_sync_at).toLocaleString('he-IL'):'טרם בוצע'}</p>
    {connection?.error_code&&<p className="gmail-error">הסנכרון האחרון נכשל. המידע המוצג עשוי להיות חלקי או לא מעודכן.</p>}
    <div className="gmail-actions"><button disabled={busy} onClick={()=>action(async()=>{
     const {data:d}=await api.post('/admin/gmail/connect',{email});
     const url=new URL(d.url),backend=new URL(api.defaults.baseURL,window.location.origin);
     if(url.origin!==backend.origin||url.pathname!=='/api/admin/gmail/authorize')throw new Error('Unexpected provider');window.location.assign(url.href);
    })}>{connection?'חיבור מחדש':'חיבור מאובטח לגוגל'}</button>
    {connection&&<><button disabled={busy} onClick={()=>action(async()=>{
     const {data:d}=await api.post('/admin/gmail/sync',{email}, {timeout:600000});
     setNotice(`עובדו ${d.imported} מיילים. ${d.hasMore?'נותרו מיילים נוספים לייבוא.':'בדיקת 30 הימים האחרונים הסתיימה.'}`);await load();
    })}>{connection.has_more?'ייבוא 25 המיילים הבאים':'ייבוא פרטי מיילים מ־30 הימים האחרונים'}</button>
    {connection.pending_body_scan>0&&<button disabled={busy} onClick={()=>action(async()=>{
     const {data:d}=await api.post('/admin/gmail/sync',{email,scanExisting:true},{timeout:600000});
     setNotice(`נסרקו ${d.imported} מיילים קיימים. ${d.hasMore?'נותרו מיילים לסריקה בלחיצה נוספת.':'סריקת המיילים הקיימים הסתיימה.'}`);await load();
    })}>סריקת גוף למיילים קיימים ({connection.pending_body_scan})</button>}
    <button disabled={busy} onClick={()=>action(async()=>{
     if(!window.confirm(`לנתק את ${email} מ־NETWORTH? התיבה האחרת לא תנותק. פרטי מיילים שכבר יובאו והשיוכים יישארו שמורים.`))return;
     await api.post('/admin/gmail/disconnect',{email});await load();setNotice('הגישה השמורה לתיבה נמחקה. לביטול ההרשאה גם בגוגל, הסר את NETWORTH בהרשאות חשבון Google.');
    })}>ניתוק מהמערכת</button></>}
    </div>
   </article>)}
   <p className="gmail-note">בייבוא ובסריקה ידנית נקרא גם גוף ההודעה לזיהוי ת״ז. הגוף אינו נשמר; פרטי המייל ותוצאות הזיהוי נשמרים מוצפנים. קבצים מצורפים אינם נסרקים. אין סריקה ברקע, שליחה או שינוי סטטוסים בגוגל.</p>
  </section>
  {clientId&&<p>מוצגים מיילים ששויכו ללקוח בלבד. <Link to="/admin/mail">לכל המיילים</Link></p>}
  <section className="gmail-panel"><h2>מיילים לבדיקה ושיוך</h2>
   <div className="gmail-actions" aria-label="סינון מיילים">{[['work','לטיפול'],['relevant','קשורים ללקוח'],['review','דורשים בדיקה'],['hidden','פרסומות ומוסתרים'],['all','הכול']].map(([value,label])=><button key={value} disabled={busy} aria-pressed={view===value} onClick={()=>{setView(value);setOffset(0);setData(d=>({...d,messages:[]}));}}>{label}</button>)}</div>
   <p className="gmail-note">ת״ז בנושא או בגוף ההודעה יכולה ליצור הצעת שיוך. כמה תעודות זהות או כמה התאמות נשארות לבדיקה ידנית. פרסומות חשודות מוסתרות מ״לטיפול״, לא נמחקות. אפשר להחזירן מתצוגת ״פרסומות ומוסתרים״.</p>
   {busy&&<p role="status">הפעולה מתבצעת...</p>}
   {!data.messages.length&&<p>עדיין אין מיילים להצגה{clientId?' עבור הלקוח הזה':''}.</p>}
   {data.messages.map(m=><article key={`${m.mailbox}:${m.message_id}`} className="gmail-message">
    <p>תיבת מקור: <bdi>{m.mailbox}</bdi></p>
    <div className="gmail-line"><span>{m.direction==='outgoing'?'יוצא':'נכנס'} · {new Date(m.message_at).toLocaleString('he-IL')}</span><span>{m.client_id?'שויך ידנית':'ממתין לשיוך'}</span></div>
    <h3>{m.subject||'(ללא נושא)'}</h3><p>מאת: <bdi>{m.from}</bdi></p><p>אל: <bdi>{m.to}</bdi></p>
    {m.cc&&<p>עותק: <bdi>{m.cc}</bdi></p>}
    {m.triage&&<p className="gmail-note">{m.triage.reason}</p>}
    {m.bodyScan&&<p className="gmail-note">{{pending:'גוף ההודעה טרם נסרק — אפשר לסרוק מיילים קיימים למעלה.',complete:`גוף ההודעה נסרק; נמצאו ${m.bodyScan.idCount} תעודות זהות תקינות מבחינת ספרת ביקורת.`,partial:'הסריקה חלקית; אין להסיק שלא קיימות תעודות זהות נוספות.',no_text:'לא נמצא גוף טקסט נתמך. קבצים מצורפים לא נבדקו.',unavailable:'המייל אינו זמין עוד לסריקה בגוגל.'}[m.bodyScan.status]}</p>}
    {m.suggestions.length>0&&<p className="gmail-note">{m.suggestions.map(s=>`${s.name}: ${s.reason}`).join(' · ')}. אין שיוך אוטומטי.</p>}
    {!m.client_id&&<button disabled={busy} onClick={()=>action(async()=>{
     await api.post(`/admin/gmail/messages/${encodeURIComponent(m.message_id)}/triage`,{email:m.mailbox,bucket:m.triage?.bucket==='hidden'?'review':'hidden'});await load();
    })}>{m.triage?.bucket==='hidden'?'החזרה לבדיקה':'הסתרה מהטיפול'}</button>}
    <div className="gmail-actions"><label>לקוח לשיוך <select aria-label={`לקוח לשיוך: ${m.subject||m.message_id}`} value={choices[`${m.mailbox}:${m.message_id}`]??m.client_id??''} onChange={e=>setChoices({...choices,[`${m.mailbox}:${m.message_id}`]:e.target.value})}>
     <option value="">ללא שיוך</option>{data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label><button disabled={busy} onClick={()=>action(async()=>{
     const id=choices[`${m.mailbox}:${m.message_id}`]??m.client_id??null;
     await api.post(`/admin/gmail/messages/${encodeURIComponent(m.message_id)}/link`,{clientId:id||null,email:m.mailbox});await load();setNotice('השיוך נשמר ונרשם בהיסטוריית השינויים.');
    })}>אישור השיוך</button>{m.client_id&&<Link to={`/admin/clients/${m.client_id}`}>כרטיס לקוח</Link>}</div>
   </article>)}
   <div className="gmail-actions"><button disabled={!offset||busy} onClick={()=>setOffset(Math.max(0,offset-50))}>הקודם</button><span>עמוד {offset/50+1}</span><button disabled={!data.hasMore||busy} onClick={()=>setOffset(offset+50)}>הבא</button></div>
  </section>
 </section>;
}
