// Component QA harness: synthetic, in-memory only. Never touches demo leads or live APIs.
import React,{useState} from 'react';
import {makeClient,fixtures,completeDecision,event} from './workflow-model.js';
import {actionOptions,completeTask,closeTreatment} from './workflow-process.js';
import {applyCompanyMail} from './workflow-mail.js';
import Operation from './workflow-operation.jsx';
import Followup from './workflow-followup.jsx';
import './workflow-demo.css';
import './workflow-v2.css';
import './workflow-process.css';
function start(){const c=makeClient({name:'לקוח בדיקה סינתטי',phone:'0500000000'});c.products=fixtures('2026-01-01').filter(p=>p.category==='בריאות');c.decisions=[{id:'qa-health',productId:c.products[0].id,action:actionOptions[7],processVersion:3,clientApproved:true,target:'הפניקס',riders:['תרופות מחוץ לסל'],riderDetail:'נספח דמה בלבד',targetPremium:100}];return c;}
export default function HealthCheck(){const [c,setClient]=useState(start),[error,setError]=useState('');const d=c.decisions[0];
 const run=fn=>{try{setClient(fn(c));setError('');}catch(err){setError(err.message);}};
 const change=(patch,text)=>run(c=>({...c,decisions:[{...c.decisions[0],...patch}],events:[...c.events,event(text)]}));
 const mail=kind=>run(c=>{const m={id:crypto.randomUUID(),decisionId:d.id,kind,at:new Date().toISOString(),execution:kind==='אישור'?{policy:'DEMO-HEALTH-NEW',effective:'2026-08-02',evidence:'מייל דמה היסטורי'}:undefined};return {...c,messages:[...c.messages,m]};});
 return <main className="wf" dir="rtl" style={{padding:24,maxWidth:1150,margin:'auto'}}><h1>בדיקת שחלוף בריאות — נתונים סינתטיים בלבד</h1><p>אותם רכיבי תפעול של הדמו. ללא שמירה, לידים או שליחות. הפקה היסטורית ל־2.8.2026 מאפשרת לבדוק מעקב 14 ימי עסקים.</p>{error&&<p role="alert">{error}</p>}
 <Operation d={d} p={c.products.find(p=>p.id===d.productId)} summarySent={!d.requiresNewSummary} change={change} mail={mail} template={()=>change({messagePrepared:true,messageText:'הודעת בדיקה בלבד'},'נשמר נוסח דמה')} finish={()=>run(c=>completeDecision(c,c.decisions[0]))}/>
 {c.messages.filter(m=>!m.applied).map(m=><div className="wf-panel" key={m.id}><p>מייל דמה: {m.kind}</p><button onClick={()=>run(c=>applyCompanyMail(c,m))}>שיוך מייל {m.kind}</button></div>)}
 {d.produced&&!d.completed&&<Followup d={d} change={change} onTask={(key,data)=>{const next=completeTask(c,d.id,key,data);setClient(next);}} onClose={()=>run(c=>closeTreatment(c,c.decisions[0]))}/>}
 <section className="wf-panel"><h2>תוצאת הבדיקה</h2><p>מצב: {d.completed?'הטיפול הושלם':d.stopped?'ההצטרפות הופסקה':'בתהליך'}</p>{c.products.map(p=><p key={p.id}>{p.policy} · {p.company} · {p.archived?'בהיסטוריה':p.pendingCancellation?'ממתין לביטול':'פעיל'}</p>)}<p>שיחות ביומן: {c.appointments.length}</p></section></main>;
}
