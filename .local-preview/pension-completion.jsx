import React,{useState} from 'react';
import {pensionTransferReady} from './workflow-process.js';
import TransferChecks from './workflow-transfer.jsx';
import PensionVerification from './pension-verification.jsx';
export default function PensionCompletion({d,p,change,onFinish,clientName}){
 const [channel,setChannel]=useState('וואטסאפ'),[error,setError]=useState('');
 const [message,setMessage]=useState(d.consolidationId?`שלום ${clientName}, העברת הכספים מקרן המקור ${p.company} במסגרת האיחוד אומתה. יתר קרנות המקור נמצאות במעקב נפרד; אין בכך אישור להשלמת האיחוד כולו. אני זמין לכל שאלה.\nדוד`:`שלום ${clientName}, תהליך ניוד קרן הפנסיה שלך הסתיים בהצלחה. אני זמין לכל שאלה.\nדוד`);
 if(d.consolidationId)return <section className="wf-panel"><h2>קליטת מקור באיחוד הקופות</h2>{d.produced?<p className="wf-success">המקור נקלט. עדכון אחד ללקוח יופיע בכרטיס האיחוד לאחר אימות כל המקורות.</p>:<>{!pensionTransferReady(d)&&<TransferChecks d={d} p={p} change={change}/>}<PensionVerification d={d} change={change}/><p>אין צורך בהודעה נפרדת ללקוח על מקור זה.</p><button disabled={!pensionTransferReady(d)} onClick={()=>onFinish()}>אימות וקליטת המקור באיחוד</button></>}</section>;
 return <section className="wf-panel"><h2>{d.consolidationId?'השלמת מקור באיחוד הקופות':'סיום ניוד הפנסיה'}</h2>{d.completed?<p className="wf-success">{d.consolidationId?'הלקוח עודכן ומהלך המקור נסגר.':'הלקוח עודכן והתהליך נסגר.'}</p>:<>
 {!pensionTransferReady(d)&&<><p className="wf-warning">לא ניתן לסגור: יש להשלים את בדיקות הביצוע ולסגור בירורים פתוחים.</p><TransferChecks d={d} p={p} change={change}/></>}
 <PensionVerification d={d} change={change}/>
 <p>{d.consolidationId?'עדכון וסגירת מקור זה בלבד. האיחוד כולו ייחשב מושלם רק לאחר אימות כל המקורות.':'עדכון הלקוח וסגירת מהלך הפנסיה בלבד. מהלכים אחרים בתיק נשארים ללא שינוי.'}</p>
 <label className="wf-field">נוסח עדכון מוכן<textarea value={message} onChange={e=>setMessage(e.target.value)}/></label>
 <button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(message);setError('הנוסח הועתק');}catch{setError('לא ניתן להעתיק. אפשר לסמן ולהעתיק את הטקסט.');}}}>העתקת הנוסח</button>
 <label className="wf-field">איך עדכנת את הלקוח?<select value={channel} onChange={e=>setChannel(e.target.value)}>{['וואטסאפ','טלפון','מייל'].map(v=><option key={v}>{v}</option>)}</select></label>
 <p className="wf-muted">אין שליחה אוטומטית. לחץ רק לאחר שעדכנת את הלקוח בפועל.</p>
 {error&&<p role="status">{error}</p>}<button disabled={!pensionTransferReady(d)||!message.trim()} onClick={()=>onFinish(channel,message)}>עדכנתי את הלקוח — סיום ניוד הפנסיה</button>
 </>}</section>;
}
