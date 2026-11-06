import React,{useState} from 'react';
import {homeTasks} from './workflow-home-model.js';
import {israelDate} from './workflow-process.js';

const displayDate=d=>new Date(d+'T12:00:00').toLocaleDateString('he-IL');
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function OwnerDashboard({clients,onOpen}){
 const today=israelDate(),tasks=homeTasks(clients,today);
 const due=tasks.filter(t=>t.due===today),late=tasks.filter(t=>t.due&&t.due<today);
 const focus=tasks.filter(t=>t.urgent||!t.due||t.due<=today).slice(0,4);
 const next=clients.flatMap(c=>(c.appointments||[]).map(a=>({...a,clientId:c.id,clientName:c.name}))).filter(a=>!a.done&&!a.cancelled&&new Date(a.when)>=new Date()).sort((a,b)=>a.when.localeCompare(b.when))[0];
 return <div className="owner-dashboard"><small>NETWORTH / סביבת פיתוח</small><h1>לוח מחוונים לבעלים</h1><p>תמונת מצב עסקית ומה דורש את תשומת הלב שלך.</p><div className="nw-home-metrics">{[['תיקי לקוחות',clients.length],['להיום',due.length],['באיחור',late.length],['ללא מועד',tasks.filter(t=>!t.due).length]].map(([label,value])=><section key={label}><small>{label}</small><strong>{value}</strong></section>)}</div><section className="nw-next-meeting"><div><small>הפגישה הקרובה</small><h2>{next?.title||'אין פגישה קרובה'}</h2>{next&&<p>{next.clientName} · {displayDate(next.when.slice(0,10))} · {next.when.slice(11,16)}</p>}</div>{next&&<button className="secondary" onClick={()=>onOpen(next.clientId,'סקירה')}>הכנה לפגישה ←</button>}</section><section className="wf-panel"><h2>דורש תשומת לב</h2><p>עד ארבע פעולות קרובות. הרשימה המלאה במסך המשימות.</p>{focus.map(t=><div className="nw-task" key={t.id}><div><strong>{t.title}</strong><p>{t.clientName}</p></div><span>{t.due?displayDate(t.due):'חסר מועד'}</span><button className="secondary" onClick={()=>onOpen(t.clientId,t.tab)}>לטיפול ←</button></div>)}{!focus.length&&<p>אין כרגע פעולות דחופות לטיפול.</p>}</section></div>;
}
export function OwnerWeek({clients,onOpen,onEdit}){
 const [offset,setOffset]=useState(0),today=israelDate();
 const start=new Date(today+'T12:00:00');start.setDate(start.getDate()-start.getDay()+offset*7);
 const days=Array.from({length:5},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return iso(d)});
 const appointments=clients.flatMap(c=>(c.appointments||[]).filter(a=>!a.cancelled).map(a=>({...a,clientId:c.id,clientName:c.name})));
 const tasks=homeTasks(clients,today);
 return <div className="owner-week"><small>NETWORTH / סביבת פיתוח</small><h1>יומן עסקי</h1><p>פגישות ומשימות לפי יום — מתוך התיקים הקיימים.</p><div className="owner-week-toolbar"><button className="secondary" onClick={()=>setOffset(offset-1)}>השבוע הקודם</button><strong>{displayDate(days[0])} – {displayDate(days[4])}</strong><button className="secondary" onClick={()=>setOffset(0)}>השבוע הנוכחי</button><button className="secondary" onClick={()=>setOffset(offset+1)}>השבוע הבא</button></div>{days.map((day,i)=>{const meetings=appointments.filter(a=>a.when?.slice(0,10)===day).sort((a,b)=>a.when.localeCompare(b.when)),daily=tasks.filter(t=>t.due===day);return <section className={'owner-day'+(day===today?' is-today':'')} key={day}><header><h2>{['יום ראשון','יום שני','יום שלישי','יום רביעי','יום חמישי'][i]}</h2><span>{displayDate(day)}{day===today?' · היום':''}</span></header><div className="owner-day-items">{meetings.map(a=><article key={a.id}><small>פגישה · {a.when.slice(11,16)}{a.done?' · הושלמה':''}</small><h3>{a.title}</h3><p>{a.clientName}</p><button className="secondary" onClick={()=>onOpen(a.clientId,'סקירה')}>פתיחת התיק</button>{!a.done&&<button className="secondary" onClick={()=>onEdit(a)}>עריכה / ביטול</button>}</article>)}{daily.map(t=><article key={t.id}><small>משימה</small><h3>{t.title}</h3><p>{t.clientName}</p><button className="secondary" onClick={()=>onOpen(t.clientId,t.tab)}>לטיפול ←</button></article>)}{!meetings.length&&!daily.length&&<p>אין פגישות או משימות מתוזמנות ליום זה.</p>}</div></section>})}<p>משימות ללא מועד ומשימות מסוף השבוע זמינות במסך המשימות.</p></div>;
}
