import TypedDate from './typed-date.jsx';
import React,{useState} from 'react';
import {changeAppointment} from './appointment-edit.js';

export default function AppointmentEditor({client,appointmentId,onSave,onClose}) {
 const appointment=client.appointments.find(a=>a.id===appointmentId),[error,setError]=useState(''),[cancelling,setCancelling]=useState(false),[saving,setSaving]=useState(false);
 if(!appointment)return <p role="alert">הפגישה לא נמצאה.</p>;
 function submit(e){e.preventDefault();setError('');try{const fields=Object.fromEntries(new FormData(e.currentTarget));const next=changeAppointment(client,appointmentId,cancelling?{cancelled:true,reason:fields.reason}:fields);setSaving(true);const accepted=onSave(next,cancelling?'הפגישה בוטלה ונשמר תיעוד הביטול':'פרטי הפגישה עודכנו',onClose);if(accepted===false){setSaving(false);setError('השמירה לא הושלמה.');}}catch(err){setSaving(false);setError(err.message);}}
 return <form onSubmit={submit}>
 <p className="wf-muted">השינוי יישמר בתיק ולאחר מכן יסונכרן לאותו אירוע בגוגל, אם היומן מחובר. לא נשלח מייל למשתתפים.</p>
 {cancelling?<><p>לבטל את הפגישה „{appointment.title}”? התיעוד יישמר בהיסטוריה.</p><label className="wf-field">סיבת ביטול (רשות)<textarea name="reason" maxLength="240"/></label></>:<>
 <label className="wf-field">נושא<TypedDate name="title" required maxLength="120" defaultValue={appointment.title}/></label>
 <label className="wf-field">סוג פגישה<select name="type" defaultValue={appointment.type||'המשך טיפול'}>{[...new Set([appointment.type,'פגישת היכרות','בדיקת תיק פנסיוני','המשך טיפול','פגישת שירות שנתית'].filter(Boolean))].map(t=><option key={t}>{t}</option>)}</select></label>
 <label className="wf-field">תאריך ושעה<TypedDate name="when" type="datetime-local" required defaultValue={appointment.when?.slice(0,16)}/></label>
 <label className="wf-field">אופן הפגישה<select name="mode" defaultValue={appointment.mode||''}>{['','זום','טלפון','פגישה פרונטלית'].map(t=><option key={t} value={t}>{t||'לא צוין'}</option>)}</select></label></>}
 {error&&<p role="alert">{error}</p>}
 <div className="wf-actions"><button disabled={saving||appointment.done||appointment.cancelled}>{saving?'שומר…':cancelling?'אישור ביטול הפגישה':'שמירת שינויי הפגישה'}</button><button type="button" className="secondary" disabled={saving} onClick={()=>setCancelling(v=>!v)}>{cancelling?'חזרה לעריכה':'ביטול הפגישה'}</button></div>
 </form>;
}
