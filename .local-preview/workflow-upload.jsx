import TypedDate from './typed-date.jsx';
import {newReports} from './workflow-report-identity.js';
import {mergeSourceProfile} from './source-profile.js';
import React,{useEffect,useReducer,useRef,useState} from 'react';
import {filesFromUploads,processMaslakaFiles} from '../frontend/src/lib/maslakaCards.js';
import {parseHarBituach,groupHarBituachByPolicy} from '../frontend/src/lib/harBituachParser.js';
import {reportDate,onlyDate} from '../frontend/src/lib/reportMetadata.js';
import {classifyProduct} from './product-registry.js';
import {prepareMaslakaUpload} from './maslaka-upload-owner.js';
import {initialUploadState,uploadReducer,canConfirmUpload} from './report-upload-state.js';
const identity=v=>String(v||'').trim().replace(/^0+(?=\d)/,'');
const company=v=>['איילון','הראל','הפניקס','מנורה','כלל','מיטב','מור','מגדל'].find(n=>(v||'').includes(n))||v;
function normalize(raw,source,asOf){
 const p=classifyProduct(raw),text=[p.name,...p.coverageItems||[]].join(' ');
 const category=p.type==='pension'?'פנסיה':/השתלמות/.test(text)?'השתלמות':/גמל להשקעה/.test(text)?'גמל להשקעה':p.type==='gemel'?'גמל':/מחלות קשות|מחלה קשה/.test(p.name)?'מחלות קשות':/תאונות/.test(p.name)?'תאונות אישיות':/סיעוד/.test(text)?'סיעוד':({life:'ביטוח חיים',health:'בריאות',accident:'תאונות אישיות',managers:'ביטוח מנהלים',disability:'אובדן כושר עבודה'}[p.type]||'ביטוח אחר');
 const provider=company(p.provider),policy=String(p.id).trim();
 // Preserve the account number, but distinguish pension funds sharing that number.
 if(raw.pensionIdentity){
  const card=normalize({...raw,pensionIdentity:undefined},source,asOf);
  return {...card,pensionIdentity:raw.pensionIdentity,importKey:card.importKey+':pension:'+raw.pensionIdentity};
 }
 return {id:crypto.randomUUID(),providerReported:p.provider,productType:raw.productType,status:raw.status,importKey:provider+':'+policy,company:provider==='מנורה'?'מנורה מבטחים':provider,policy,category,groupClassification:raw.groupClassification,isCollective:source==='har_bituach'?raw.isCollective:undefined,name:p.name,asOf,source,coverage:[...(p.coverageItems||[]).map(name=>({name})),...(['ביטוח חיים','מחלות קשות'].includes(category)&&p.coverage!=null?[{name:'סכום ביטוח',amount:p.coverage}]:[])],balance:['פנסיה','השתלמות','גמל','גמל להשקעה','ביטוח מנהלים'].includes(category)?p.balance:undefined,deposit:p.monthlyDeposit,premium:p.monthlyPremium,track:p.investmentTrack,depositFee:p.feeFromDeposit,balanceFee:p.feeFromAccumulation,warning:[p.hasLien?'דווח עיקול — לפי תאריך הדוח':'',p.hasPledge?'דווח שעבוד':'',p.warningText].filter(Boolean).join(' · ')};
}
export function mergeReports(client,reports){
 client=mergeSourceProfile(client,reports);
 // Repair previously imported pension rows on explicit re-upload, retaining IDs,
 // decisions and original reports. Match legacy rows by plan, never account alone.
 const repaired=[...client.products];
 for(const r of reports.filter(r=>r.source==='maslaka'))for(const raw of r.cards.filter(p=>p.pensionIdentity)){
  const p=normalize(raw,r.source,r.asOf);
  const index=repaired.findIndex(old=>old.importKey===p.importKey||(!old.pensionIdentity&&old.category==='פנסיה'&&old.company===p.company&&identity(old.policy)===identity(p.policy)&&old.name===p.name));
  if(index>=0){const old=repaired[index];if(p.asOf>=old.asOf)repaired[index]={...old,...p,id:old.id,note:old.note,archived:old.archived,history:old.history};}
  else if(client.reports?.some(old=>old.fingerprint===r.fingerprint&&old.source===r.source))repaired.push(p);
 }
 client={...client,products:repaired};
 const sourceReports=(client.reports||[]).map(old=>{const r=reports.find(r=>r.fingerprint&&r.fingerprint===old.fingerprint&&r.source===old.source);return r?.sourceFile&&!old.sourceFile?{...old,sourceFile:r.sourceFile}:old;});
 if(sourceReports.some((r,i)=>r!==client.reports[i]))client={...client,reports:sourceReports};
 // Re-importing the same report can enrich fields absent in older CRM versions,
 // without duplicating products, overwriting decisions or adding report history.
 let enriched=false;
 const productsWithClassification=client.products.map(old=>{
  for(const r of reports.filter(r=>r.source==='har_bituach'))for(const raw of r.cards){
   const p=normalize(raw,r.source,r.asOf);
   if(p.importKey===old.importKey&&(p.groupClassification||p.isCollective!==undefined)&&
      (old.groupClassification!==p.groupClassification||old.isCollective!==p.isCollective)){
    enriched=true;return {...old,groupClassification:p.groupClassification,isCollective:p.isCollective};
   }
  }
  return old;
 });
 if(enriched)client={...client,products:productsWithClassification};
 reports=newReports(client.reports||[],reports);
 if(!reports.length)return client;
 const products=[...client.products];
 for(const r of reports) for(const raw of r.cards){const p=normalize(raw,r.source,r.asOf),index=products.findIndex(x=>x.importKey===p.importKey);
  if(index<0)products.push(p);else{const old=products[index];const {history,...snapshot}=old;products[index]=p.asOf>=old.asOf?{...p,id:old.id,note:old.note,archived:old.archived,history:[...(history||[]),snapshot]}:{...old,history:[...(history||[]),p]};}
 }
 return {...client,products,reports:[...client.reports,...reports.map(({cards,...r})=>({...r,products:cards.length}))],info:'קבצים נקלטו מקומית',stage:client.meetingDone?client.stage:'הכנה לפגישה'};
}
export default function UploadReports({client,onSave,archiveSource}){
 const [state,dispatch]=useReducer(uploadReducer,initialUploadState);
 const {reports,errors}=state;const [archiving,setArchiving]=useState(false),[archiveError,setArchiveError]=useState('');const sources=useRef(new Map()),archives=useRef(new Map());const busy=state.busy||archiving;
 const saveLatest=useRef(onSave),saving=useRef(false),mounted=useRef(true);saveLatest.current=onSave;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function confirm(e){e.preventDefault();if(!canConfirmUpload(state)||saving.current)return;saving.current=true;setArchiving(true);setArchiveError('');try{const ready=[];for(const report of reports){let sourceFile=archives.current.get(report.fingerprint);if(archiveSource&&!sourceFile){sourceFile=await archiveSource(sources.current.get(report.fingerprint),report.source);if(!sourceFile?.id||sourceFile.sha256!==report.fingerprint)throw Error('שמירת קובץ המקור לא אושרה. הקליטה לא הושלמה.');archives.current.set(report.fingerprint,sourceFile);}ready.push({...report,...(sourceFile?{sourceFile}:{})});}if(mounted.current)saveLatest.current(ready);}catch(err){if(mounted.current)setArchiveError(err.message||'שמירת המקור נכשלה. ניתן לנסות שוב.');}finally{saving.current=false;if(mounted.current)setArchiving(false);}}
 async function read(file,source){if(!file)return;dispatch({type:'start',source});try{
  if(!/^\d{9}$/.test(client.identity||''))throw Error('יש להשלים תעודת זהות בת תשע ספרות בפרטים והרשאות לפני קליטה.');
  if(client.decisions.some(d=>d.completed)||client.products.some(p=>!p.importKey))throw Error('בתיק הזה יש מוצרי דוגמה או מהלכים שכבר נסגרו. פתח ליד חדש לקליטת דוחות אמיתיים, כדי לא לערבב או לדרוס נתונים.');
  if(file.size>30*1024*1024)throw Error('הקובץ גדול מ־30MB. יש לפצל את הדוח.');
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
  let cards=[],asOf='',excludedPolicies=[],customerEmails=[],customerProfile;
  if(source==='maslaka'){
   if(!/\.(zip|xml)$/i.test(file.name))throw Error('יש לבחור קובץ ZIP או XML של המסלקה.');
   const files=await filesFromUploads([file]);if(!files.length)throw Error('לא נמצאו קובצי XML במסלקה.');
   const docs=files.map(f=>new DOMParser().parseFromString(f.text,'text/xml'));
   if(docs.some(d=>d.querySelector('parsererror')))throw Error('אחד מקובצי המסלקה אינו XML תקין.');
   const prepared=prepareMaslakaUpload(files,client.identity);excludedPolicies=prepared.excludedPolicies;customerEmails=prepared.customerEmails;customerProfile=prepared.customerProfile;
   const parsed=processMaslakaFiles(prepared.files,{includeEmptyAccounts:true});cards=[...parsed.pensionCards,...parsed.insuranceCards];
   asOf=onlyDate(docs.flatMap(d=>[...d.getElementsByTagName('TAARICH-NECHONUT')].map(n=>n.textContent)));
  }else{
   if(!/\.xlsx?$/i.test(file.name))throw Error('יש לבחור קובץ Excel של הר הביטוח.');
   const rows=parseHarBituach(await file.arrayBuffer());const ids=[...new Set(rows.map(r=>identity(r.tz)))];
   if(ids.length!==1||ids[0]!==identity(client.identity))throw Error('הר הביטוח אינו שייך לת״ז בתיק או מכיל כמה לקוחות. הקליטה נעצרה.');
   cards=[...new Set(rows.map(r=>r.company))].flatMap(v=>groupHarBituachByPolicy(rows.filter(r=>r.company===v)));
   asOf=reportDate(file.name.match(/\d{4}-\d{2}-\d{2}/)?.[0]);
  }
  if(!cards.length)throw Error(excludedPolicies.length?'כל הפוליסות דורשות בדיקת מבוטחים לפני שיוך. התיק לא השתנה.':'לא נמצאו מוצרים שניתן לקלוט בקובץ. התיק לא השתנה.');
  sources.current.set(fingerprint,file);dispatch({type:'success',report:{id:crypto.randomUUID(),source,fingerprint,name:file.name,asOf,at:new Date().toISOString(),cards,excludedPolicies,customerEmails,customerProfile}});
 }catch(e){dispatch({type:'error',source,message:e.message||'לא ניתן לקרוא את הקובץ.'});}}
 return <div>
  <p>בחר מסלקה והר הביטוח, בדוק את שני הדוחות ואשר קליטה אחת לתיק. אפשר גם לקלוט דוח יחיד. פוליסות משותפות יוצגו פעם אחת, לפי הדיווח המאוחר יותר.</p>
  <p className="wf-muted">{archiveSource?'לאחר אישור הקליטה קובץ המקור יישמר באופן פרטי בשרת הבדיקה, ויהיה זמין בלשונית מסמכים. העיבוד והתאמת הת״ז מתבצעים לפני השמירה.':'העיבוד מתבצע מקומית. בדמו המקומי קובצי המקור אינם נשמרים; שמור אותם אצלך.'}</p>
  {[['maslaka','קובץ מסלקה (ZIP / XML)','.zip,.xml'],['har_bituach','קובץ הר הביטוח (Excel)','.xlsx,.xls']].map(([source,label,accept])=><div key={source}>
   <label className="wf-field"><span>{label}</span><TypedDate type="file" accept={accept} disabled={busy} onChange={e=>{const file=e.target.files[0];e.target.value='';read(file,source);}}/></label>
   {errors[source]&&<div role="alert" className="wf-error"><p>{errors[source]}</p><button type="button" disabled={busy} onClick={()=>dispatch({type:'remove',source})}>הסרת הקובץ שנכשל — {source==='maslaka'?'מסלקה':'הר הביטוח'}</button></div>}
  </div>)}
  {busy&&<p role="status">בודק את הקובץ ואת התאמתו לתיק…</p>}
  {archiveError&&<p className="wf-error" role="alert">{archiveError}</p>}
  {reports.length>0&&<form onSubmit={confirm}>
   <h3>{reports.length===2?'שני הדוחות מתאימים לת״ז שבתיק':'הקובץ מתאים לת״ז שבתיק'}</h3>
   {reports.map(r=><section key={r.id} aria-label={r.source==='maslaka'?'דוח מסלקה מוכן לקליטה':'דוח הר הביטוח מוכן לקליטה'}>
    <h4>{r.source==='maslaka'?'מסלקה':'הר הביטוח'}</h4><p>{r.name} · {r.cards.length} מוצרים לפני איחוד</p>
    <button type="button" disabled={busy} onClick={()=>dispatch({type:'remove',source:r.source})}>הסר {r.source==='maslaka'?'מסלקה':'הר הביטוח'} מהקליטה</button>
    {r.excludedPolicies?.length>0&&<div className="wf-warning" role="status"><strong>{r.excludedPolicies.length} פוליסות לא ייקלטו ודורשות בדיקה</strong><ul>{r.excludedPolicies.map((p,i)=><li key={i}>פוליסה {p.policy}: {p.reason}</li>)}</ul><p>הסכומים והכיסויים שלהן לא יתווספו למוצרי הלקוח. פרטי ההחרגה יישמרו עם רישום הדוח; קובץ המקור אינו משתנה.</p></div>}
    <label className="wf-field"><span>תאריך נכונות הנתונים — {r.source==='maslaka'?'מסלקה':'הר הביטוח'}</span><TypedDate type="date" required disabled={busy} value={r.asOf} onChange={e=>dispatch({type:'date',id:r.id,value:e.target.value})}/></label>
   </section>)}
   <p className="wf-muted">בדוק תאריך נכונות לכל דוח — לא את יום ההעלאה. שום דוח לא נשמר לתיק עד האישור.</p>
   {Object.values(errors).some(Boolean)&&<p className="wf-error">יש לתקן או להסיר את הקובץ שנכשל לפני אישור הקליטה.</p>}
   <button disabled={busy||!canConfirmUpload(state)}>{reports.length===2?'אישור קליטת שני הדוחות לתיק':'אישור קליטה לתיק'}</button>
  </form>}
 </div>;
}
