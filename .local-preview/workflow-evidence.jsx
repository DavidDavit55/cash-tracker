import React,{useState} from 'react';
import {downloadSourceFile} from '../frontend/src/lib/stagingFiles.js';
export function demoDocument(name) {
 const text=`הדגמה בלבד — אינו מסמך תקף, פוליסה או חתימה\n${name}\nנוצר לצורך בדיקת תהליך מקומי בלבד.`;
 return {name:`${name}-DEMO.txt`,data:'data:text/plain;charset=utf-8,'+encodeURIComponent(text),at:new Date().toISOString(),simulated:true};
}
export default function Evidence({label,file,onChange,disabled=false}) {
 const [error,setError]=useState('');
 async function upload(e){const item=e.target.files[0];e.target.value='';if(!item)return;if(item.size>700000){setError('הקובץ מוגבל ל־700KB. דבר לא נשמר.');return;}const mime={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',txt:'text/plain'}[item.name.split('.').at(-1).toLowerCase()];if(!mime){setError('יש לבחור PDF, תמונה או קובץ טקסט. דבר לא נשמר.');return;}try{const bytes=await item.arrayBuffer(),sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');const reader=new FileReader();reader.onerror=()=>setError('קריאת הקובץ נכשלה');reader.onload=()=>{onChange({name:item.name,data:reader.result,sha256,size:item.size,mime,at:new Date().toISOString()});setError('');};reader.readAsDataURL(new Blob([bytes],{type:mime}));}catch{setError('קריאת הקובץ נכשלה. דבר לא נשמר.');}}
 return <div className="wf-evidence"><label className="wf-field">{label}<input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" disabled={disabled} onChange={upload}/></label>{file&&(file.privateFile?<button type="button" className="wf-link" onClick={()=>downloadSourceFile(file).catch(()=>setError('הורדת המסמך נכשלה'))}>{file.name} — אישור שמור</button>:<a href={file.data} download={file.name}>{file.simulated?'מסמך דמה: ':''}{file.name}</a>)} {!disabled&&<button type="button" className="secondary" onClick={()=>onChange(demoDocument(label))}>יצירת מסמך דמה — {label}</button>}{error&&<p role="alert">{error}</p>}</div>;
}
