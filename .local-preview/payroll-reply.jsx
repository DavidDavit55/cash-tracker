import React,{useState} from 'react';
import TypedDate from './typed-date.jsx';
import {israelDate} from './workflow-process.js';
import {payrollReplyDue,recordPayrollReply} from './payroll-reply.js';
export default function PayrollReply({d,change}){
 const [status,setStatus]=useState(''),[error,setError]=useState('');
 return <form className="wf-step-next" onSubmit={e=>{e.preventDefault();setError('');try{const data=Object.fromEntries(new FormData(e.currentTarget));if(change(recordPayrollReply(d,data),'תועד מעקב תשובת חשבת השכר — ללא אישור הפקדה')===false)throw Error('השמירה לא הושלמה');setStatus('');}catch(err){setError(err.message);}}}>
 <h4>וידוא אישור מחשבת השכר על עדכון ההפקדות</h4><p>מועד מעקב: {payrollReplyDue(d)||'חסר תאריך שליחת המייל'} — יומיים עסקים מהשליחה. אישור קבלה בלבד אינו אישור עדכון ואינו הוכחת הפקדה.</p>
 {d.transfer.payrollReply&&<p>מעקב קודם: {d.transfer.payrollReply.date} · {d.transfer.payrollReply.evidence}</p>}
 <label className="wf-field">תוצאת המעקב<select required name="status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">בחר תוצאה</option><option value="no-reply">טרם התקבלה תשובה</option><option value="received">אישרה קבלה בלבד</option><option value="missing">נדרשות השלמות</option><option value="confirmed">אישרה עדכון ההפקדות</option></select></label>
 <label className="wf-field">תאריך הבדיקה / התשובה<TypedDate name="date" type="date" required max={israelDate()}/></label>
 {status==='confirmed'&&<label className="wf-field">העדכון יחול מחודש שכר<TypedDate name="salaryMonth" type="month" required/></label>}
 <label className="wf-field">תוכן התשובה ואסמכתה / תוצאת המעקב<textarea name="evidence" required/></label>
 <button>שמירת מעקב תשובת חשבת השכר</button>{error&&<p role="alert">{error}</p>}
 </form>;
}
