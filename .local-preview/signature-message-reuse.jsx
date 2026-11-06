import React,{useState} from 'react';
import {reuseSignatureMessage} from './signature-batch.js';
export default function SignatureMessageReuse({client,decision,onSave}){
 const [source,setSource]=useState(''),[error,setError]=useState('');
 const sources=client.decisions.filter(d=>d.id!==decision.id&&d.signatureMessageSentAt&&d.messageText?.trim());
 if(!decision.signatureSent||decision.signatureMessageSentAt||!sources.length)return null;
 return <details><summary>ההודעה כבר נשלחה גם עבור מוצר זה?</summary><p>בחר תיעוד קיים רק אם אותה הודעה כללה גם את המוצר הזה. לא תישלח הודעה נוספת ולא תסומן חתימה.</p><select aria-label="הודעה קיימת לקישור" value={source} onChange={e=>setSource(e.target.value)}><option value="">בחר הודעה שנשלחה</option>{sources.map(d=><option key={d.id} value={d.id}>{d.action} · {d.target||''} · {new Date(d.signatureMessageSentAt).toLocaleString('he-IL')}</option>)}</select>{source&&<p style={{whiteSpace:'pre-line'}}>{sources.find(d=>d.id===source)?.messageText}</p>}<button type="button" disabled={!source} onClick={()=>{try{if(onSave(c=>reuseSignatureMessage(c,decision.id,source))===false)throw Error('השמירה לא הושלמה');setError('');}catch(e){setError(e.message);}}}>ההודעה כללה גם מוצר זה — קישור התיעוד</button>{error&&<p role="alert">{error}</p>}</details>;
}
