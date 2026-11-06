import {useState} from 'react';
import {PARAMETERS,REVIEW_STATES} from '../lib/productReview';
import './SpecificReview.css';
const choices={high:'חשיפה מנייתית גבוהה ביחס לפרופיל הסיכון ולצורכי הלקוח',low:'חשיפה מנייתית נמוכה ביחס לפרופיל הסיכון ולטווח ההשקעה',returns:'תשואות נמוכות ביחס למסלולים מקבילים ברמת סיכון דומה ובתקופה שנבדקה',concentration:'פיזור השקעות שאינו מספק — ריכוזיות בענף, באזור גאוגרפי או בסוג נכס',good:'המסלול נמצא מתאים — ללא המלצה לשינוי',missing:'חסר מידע להשלמת הבדיקה'};
export function TrackReview({entry,disabled,onChange,current}){
 const chosen=entry.trackFindings||[],free=entry.trackFreeNote??entry.note??'';
 function save(next,note=free){onChange({trackFindings:next,trackFreeNote:note,status:next.includes('missing')?'missing':next.includes('good')?'good':next.length?'improve':'unchecked',note:[...next.map(k=>choices[k]),note].filter(Boolean).join('\n')});}
 function toggle(key){let next=chosen.includes(key)?chosen.filter(k=>k!==key):[...chosen,key];if(!chosen.includes(key)){if(['good','missing'].includes(key))next=[key];else next=next.filter(k=>!['good','missing',key==='high'?'low':key==='low'?'high':''].includes(k));}save(next);}
 return <section className="pr-track-review"><h3>מסלול השקעה</h3>{current&&<p className="pr-hint">מסלול נוכחי: {current}</p>}<p className="pr-hint">ממצאי בדיקת הסוכן — אפשר לבחור כמה. השוואת תשואות מתייחסת לתקופה ולמסלולים שנבדקו.</p><div className="pr-track-options">{Object.entries(choices).map(([key,label])=><label key={key}><input type="checkbox" disabled={disabled} checked={chosen.includes(key)} onChange={()=>toggle(key)}/><span>{label}</span></label>)}</div><details><summary>הערה חופשית{free?' — קיימת הערה':''}</summary><textarea aria-label="הערה למסלול השקעה" disabled={disabled} value={free} rows={2} onChange={e=>save(chosen,e.target.value)}/></details></section>;
}
export function HealthReview({parameter,entry,disabled,onChange}){
 const [open,setOpen]=useState(false);
 return <div className="pr-health-row"><span>{PARAMETERS[parameter]}</span><select aria-label={'מצב הכיסוי — '+PARAMETERS[parameter]} disabled={disabled} value={entry.status} onChange={e=>onChange({status:e.target.value})}>{Object.entries(REVIEW_STATES).map(([key,label])=><option key={key} value={key}>{key==='noCoverage'?'אומת שחסר כיסוי':label}</option>)}</select><button type="button" className="pr-add-note" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'סגירת הערה':entry.note?'עריכת הערה':'הוספת הערה'}</button>{open&&<label className="pr-health-note">הערה / הצעד הבא<textarea disabled={disabled} rows={2} value={entry.note||''} onChange={e=>onChange({note:e.target.value})}/></label>}</div>;
}
