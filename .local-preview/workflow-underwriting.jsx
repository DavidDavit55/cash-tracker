import React from 'react';
import {businessDate} from './workflow-process.js';
import Evidence from './workflow-evidence.jsx';
import {providers} from './workflow-model.js';
export default function Underwriting({d,change}){
 const u=d.underwriting||{},save=patch=>change({underwriting:{...u,...patch}},'עודכן טיפול בתנאי חיתום בדמו');
 return <section className="wf-kit"><h3>תנאי חיתום — נדרשת החלטת הלקוח</h3><p>מסמך מהחברה → חתימה ב-SMS 2010 → העלאת החתום → שליחה לכתובת התפעול.</p>
 <Evidence label="תנאי חיתום שהתקבלו מהחברה" file={u.source} disabled={!!u.signatureAt} onChange={source=>save({source})}/>
 <button className="secondary" disabled={!u.source?.data||!!u.signatureAt||u.alternative} onClick={()=>save({signatureAt:new Date().toISOString()})}>דימוי שליחה לחתימה ב-SMS 2010</button>
 {u.signatureAt&&!u.file&&<p className="wf-warning">תזכורת חתימה: {businessDate(u.signatureAt,2)}</p>}
 <Evidence label="מסמך חיתום חתום" file={u.file} disabled={!u.signatureAt||!!u.sentAt||u.alternative} onChange={file=>save({file})}/>
 <label className="wf-field">כתובת תפעול החברה<input type="email" disabled={!!u.sentAt} value={u.recipient||''} onChange={e=>save({recipient:e.target.value})}/></label>
 {!u.recipient&&<p className="wf-warning">משימה: השלמת כתובת התפעול. אין שליחה לשרשור המייל המקורי.</p>}
 <button disabled={!u.file?.data||!u.source?.data||!u.signatureAt||!/^\S+@\S+\.\S+$/.test(u.recipient||'')||!!u.sentAt||u.alternative} onClick={()=>save({sentAt:new Date().toISOString()})}>דימוי שליחת המסמך החתום לחברה</button>
 {u.sentAt&&<p className="wf-warning">ממתין לאישור החברה. בירור אם אין מענה עד {businessDate(u.sentAt,2)}. ההעלאה והשליחה אינן אישור הפקה.</p>}
 <div className="wf-actions"><button className="secondary" onClick={()=>save({alternative:true})}>הלקוח סירב — בדיקת חלופה</button><button className="secondary" onClick={()=>change({stopped:true,underwritingPending:false,approved:false},'הופסק תהליך ההצטרפות לפי החלטה — ללא בקשת ביטול לחברה; המוצר הקודם נשאר')}>הלקוח סירב — הפסקת ההצטרפות</button></div>
 {u.alternative&&<form onSubmit={e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));change({previousAttempts:[...(d.previousAttempts||[]),{at:new Date().toISOString(),target:d.target,underwriting:u,kit:d.kit}],target:values.target,targetPremium:values.premium,reason:values.note,requiresNewSummary:true,clientApproved:true,signatureSent:false,signed:false,sent:false,approved:false,missing:false,messagePrepared:false,underwritingPending:false,underwriting:null,kit:{},cancelAnnex:'',evidence:'',policy:'',policyDocument:null,effective:''},'נבחרה חלופה; נדרשים סיכום מעודכן וחתימות חדשות');}}><h4>חלופה לדיון ואישור מחדש</h4><label className="wf-field">חברת יעד<select name="target" required defaultValue=""><option value="">בחר חברה</option>{providers.map(company=><option key={company}>{company}</option>)}</select></label><label className="wf-field">פרמיה מוצעת לחודש<input type="number" name="premium" min="0" step="0.01" required/></label><label className="wf-field">מה השתנה בחלופה<input name="note" required maxLength="240"/></label><label className="wf-check"><input type="checkbox" required/>הלקוח אישר את החלופה; יש לעדכן את הנספחים בסיכום הפגישה</label><button>שמירת חלופה וחזרה לסיכום מעודכן</button></form>}
 </section>;
}
