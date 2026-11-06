import React,{useRef,useState,useEffect} from 'react';
import PayrollMailFiles from './payroll-mail-files.jsx';
import Evidence from './workflow-evidence.jsx';
import {openingAttachment,openingCandidates,reuseOpeningAnnex} from './opening-mail.js';
export default function OpeningMail({d,clientId,change,onProposal}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),seq=useRef(0);
 useEffect(()=>()=>{seq.current++;},[]);
 async function attach(file){
  const id=++seq.current;change(openingAttachment(d,file),'צורף מסמך למשימת פתיחת הקופה — ללא אישור פתיחה');setMessage('');
  if(!file?.data||!file.name.toLowerCase().endsWith('.pdf')){setBusy(false);return;}
  setBusy(true);
  try{
   const {scanClaimFile}=await import('../frontend/src/lib/claimScan.js');
   const blob=await (await fetch(file.data)).blob();
   const result=await scanClaimFile(new File([blob],file.name,{type:'application/pdf'}));
   if(id!==seq.current)return;
   const proposal=openingCandidates(result.pages.map(p=>p.text).join('\n'));
   onProposal(proposal.policy,`מסמך ${file.name}${file.mailId?' · מייל '+file.mailId:''}`);
   setMessage(proposal.policy?'חולץ מספר חשבון מוצע. יש לבדוק במסמך את הלקוח, החברה והחשבון לפני אישור.':proposal.ambiguous?'נמצאו כמה מספרי חשבון. יש להזין את חשבון היעד ידנית.':'לא חולץ מספר חשבון חד־משמעי. המסמך צורף; יש להזין את הפרטים ידנית.');
  }catch{if(id===seq.current)setMessage('המסמך צורף, אך החילוץ נכשל. אפשר לבדוק את המסמך ולהזין ידנית.');}
  finally{if(id===seq.current)setBusy(false);}
 }
 return <div><PayrollMailFiles clientId={clientId} fields={[["opening","אסמכתה לפתיחת קופת היעד"]]} onSelect={(_,file)=>attach(file)}/>
 <Evidence label="אסמכתה לפתיחת הקופה — העלאה ידנית" file={d.pensionFlow?.openingDocument} onChange={attach} disabled={busy}/>
 {busy&&<p role="status">מחלץ פרטים מהמסמך… אין שינוי בסטטוס הקופה.</p>}{message&&<p role="status">{message}</p>}
 {d.pensionFlow?.openingDocument&&<><label><input type="checkbox" checked={!!d.pensionFlow.openingDocumentReviewed} onChange={e=>change({pensionFlow:{...d.pensionFlow,openingDocumentReviewed:e.target.checked}},'עודכנה בדיקת התאמת האסמכתה')}/>בדקתי שהמסמך מתאים ללקוח ולקופת היעד</label><button type="button" className="secondary" disabled={!d.pensionFlow.openingDocumentReviewed||d.pensionFlow.openingDocument.simulated} onClick={()=>{change(reuseOpeningAnnex(d),'המסמך נבדק כנספח ו׳ ושויך גם למסמכי חשבת השכר');setMessage('אותו מסמך נשמר גם כנספח ו׳. לא נשלח מייל.');}}>המסמך הוא נספח ו׳ — שימוש גם לחשבת השכר</button></>}
 </div>;
}
