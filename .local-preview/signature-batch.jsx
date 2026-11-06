import React,{useState} from 'react';
import TypedDate from './typed-date.jsx';
import {dispatchCandidates,dispatchBatch,applySharedSignature} from './signature-batch.js';
import {israelDate} from './workflow-process.js';
import {productFor} from './workflow-model.js';
export default function SignatureBatch({client,onSave}){
 const candidates=dispatchCandidates(client),[excluded,setExcluded]=useState([]),[error,setError]=useState('');
 return <><SignatureRepair client={client} onSave={onSave}/>{!!candidates.length&&<form className="wf-panel" onSubmit={e=>{e.preventDefault();try{const date=new FormData(e.currentTarget).get('date'),ids=candidates.filter(d=>!excluded.includes(d.id)).map(d=>d.id);if(onSave(c=>dispatchBatch(c,ids,date,crypto.randomUUID()))===false)throw Error('השמירה לא הושלמה');setError('');}catch(err){setError(err.message);}}}>
 <h3>שליחה משותפת לחתימה ב־SMS</h3><p>תאריך אחד לכל המוצרים שסומנו ונשלחו יחד. הסר סימון ממוצר שלא נכלל בשליחה.</p>
 {candidates.map(d=><label className="wf-check" key={d.id}><input type="checkbox" checked={!excluded.includes(d.id)} onChange={e=>setExcluded(x=>e.target.checked?x.filter(id=>id!==d.id):[...x,d.id])}/>{productFor(client,d)?.category} · {d.action}{d.target?' · '+d.target:''}</label>)}
 <label className="wf-field">תאריך השליחה לחתימה<TypedDate name="date" type="date" required max={israelDate()}/></label><button disabled={!client.summarySent}>המסמכים המסומנים נשלחו לחתימה</button>
 {!client.summarySent&&<p>יש לשלוח את סיכום הפגישה לפני תיעוד השליחה לחתימה.</p>}{error&&<p role="alert">{error}</p>}</form>}</>;
}
function SignatureRepair({client,onSave}){
 const [source,setSource]=useState(''),[ids,setIds]=useState([]),[error,setError]=useState('');
 const sources=client.decisions.filter(d=>d.signed&&d.sent&&d.sms2010?.manual),targets=client.decisions.filter(d=>d.signatureSent&&!d.signed&&!d.sent&&!d.completed&&!d.stopped&&!d.produced);
 if(!sources.length||!targets.length)return null;
 return <details className="wf-panel"><summary>החתימה כבר תועדה במוצר אחר באותו קיט?</summary><p>בחר את החתימה ואת המוצרים שנחתמו יחד. התאריך הקיים יישמר, ללא שליחה נוספת וללא אישור ביצוע של החברה.</p><select aria-label="חתימה קיימת" value={source} onChange={e=>setSource(e.target.value)}><option value="">בחר תיעוד חתימה</option>{sources.map(d=><option key={d.id} value={d.id}>{d.action} · {d.target} · {d.sms2010.sentDate}</option>)}</select>{targets.map(d=><label className="wf-check" key={d.id}><input type="checkbox" checked={ids.includes(d.id)} onChange={e=>setIds(x=>e.target.checked?[...x,d.id]:x.filter(id=>id!==d.id))}/>{d.action} · {d.target}</label>)}<button type="button" disabled={!source||!ids.length} onClick={()=>{try{if(onSave(c=>applySharedSignature(c,source,c.decisions.find(d=>d.id===source),ids))===false)throw Error('השמירה לא הושלמה');setIds([]);setError('');}catch(e){setError(e.message);}}}>המוצרים המסומנים נחתמו יחד — עדכון התיעוד</button>{error&&<p role="alert">{error}</p>}</details>;
}
