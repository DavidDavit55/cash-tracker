import React,{useState} from 'react';
import {israelDate} from './workflow-process.js';
import {homeTasks,homePartition} from './workflow-home-model.js';
import './workflow-home.css';

const date=x=>x?new Date(x+'T12:00:00').toLocaleDateString('he-IL'):'חסר מועד — לבדיקה';
export default function WorkflowHome({clients,business=false,onOpen,onExamples,includeBusinessDashboard=false,embedded=false}) {
 const [filter,setFilter]=useState('today'),[expanded,setExpanded]=useState(false);
 const today=israelDate(),tasks=homeTasks(clients,today),parts=homePartition(tasks,today);
 const meetings=clients.flatMap(c=>(c.appointments||[]).map(a=>({...a,clientId:c.id,clientName:c.name}))).filter(a=>!a.done&&!a.cancelled).sort((a,b)=>a.when.localeCompare(b.when));
 const next=meetings.find(a=>new Date(a.when)>=new Date());
 const rows=filter==='future'?parts.future:filter==='all'?tasks:expanded?parts.due:parts.visible;
 const completed=clients.flatMap(c=>c.decisions||[]).filter(d=>d.completed).length;
 const open=clients.flatMap(c=>c.decisions||[]).filter(d=>!d.completed&&!d.stopped&&!['להשאיר ללא שינוי','לא מעוניין כרגע','לא הוצע / לא נדון בפגישה'].includes(d.action)).length;
 return <div className="nw-home">
  <div className="wf-title"><div>{!embedded&&<small>NETWORTH / סביבת פיתוח</small>}{embedded?<h2>לוח מחוונים עסק</h2>:<h1>{business?'תמונת העסק':'היום שלי'}</h1>}<p>{business?'מבט על אותם תיקים — ללא הזנה נוספת. המדדים כאן ראשוניים לבדיקה.':'מה דורש טיפול עכשיו — ומה הצעד הבא.'}</p></div></div>
  {business?<><div className="nw-home-metrics">{[['תיקים',clients.length],['מהלכים פתוחים',open],['מהלכים שהושלמו',completed],['פעולות להיום ובאיחור',parts.due.length]].map(([label,value])=><section key={label}><small>{label}</small><strong>{value}</strong></section>)}</div><section className="wf-panel"><h2>מצב התיקים</h2>{clients.map(c=><div className="nw-task" key={c.id}><div><strong>{c.name}</strong><p>{c.stage}</p></div><span>{(c.decisions||[]).filter(d=>d.completed).length} מהלכים הושלמו</span><button className="secondary" onClick={()=>onOpen(c.id,'סקירה')}>פתיחת התיק ←</button></div>)}{!clients.length&&<p>אין עדיין תיקים. אפשר להתחיל מליד חדש או לטעון תרחישי דוגמה מהיום שלי.</p>}</section></>:<>
   <section className="nw-next-meeting"><div><small>הפגישה הקרובה · יומן מקומי בלבד</small><h2>{next?next.title:'אין פגישה קרובה'}</h2><p>{next?`${next.clientName} · ${date(next.when.slice(0,10))} · ${next.when.slice(11,16)}`:'קובעים מועד מתוך תיק הלקוח; הוא יופיע גם כאן.'}</p></div>{next&&<button className="secondary" onClick={()=>onOpen(next.clientId,'סקירה')}>הכנה לפגישה ←</button>}</section>
   <section className="wf-panel nw-tasks"><div className="wf-section-head"><h2>הפעולות שלך <small>{parts.due.length} להיום ובאיחור</small></h2><div className="nw-filters" aria-label="סינון פעולות">{[['today','להיום'],['future',`בהמשך (${parts.future.length})`],['all',`הכל (${tasks.length})`]].map(([key,label])=><button className="secondary" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div></div>
    {rows.map(t=><div className={'nw-task'+(t.urgent?' urgent':'')} key={t.id}><span className="nw-task-mark" aria-hidden="true">{t.urgent?'!':'↗'}</span><div><strong>{t.title}</strong><p>{t.clientName}{t.detail?' · '+t.detail:''}</p></div><span className="nw-task-date">{t.urgent?'דחוף להיום':!t.due?'חסר מועד — לבדיקה':t.due===today?'היום':date(t.due)}{t.due&&t.due<today&&<small>באיחור</small>}</span><button className="secondary" onClick={()=>onOpen(t.clientId,t.tab)}>לטיפול ←</button></div>)}
    {!rows.length&&<div className="nw-home-empty"><h3>{filter==='future'?'אין כרגע פעולות מתוזמנות להמשך':'אין פעולות ברשימה הזאת'}</h3><p>הפעולות מחושבות מהתיקים ומהתהליכים. הן אינן נסגרות בלחיצה כללית על ״בוצע״.</p></div>}
    {filter==='today'&&!expanded&&parts.hidden>0&&<button className="secondary nw-more" onClick={()=>setExpanded(true)}>הצגת {parts.hidden} פעולות נוספות</button>}
   </section>
   {!clients.some(c=>c.sandboxExample)&&<section className="nw-demo-start"><div><h3>רוצה לבדוק לפני מילוי ליד?</h3><p>שלושה תיקים סינתטיים: שיחה ראשונה, הכנה לפגישה ומעקב חתימה. לא מוחקים תיקים קיימים.</p></div><button className="secondary" onClick={onExamples}>טעינת תרחישי דוגמה</button></section>}
   {includeBusinessDashboard&&<section className="business-dashboard"><WorkflowHome clients={clients} business embedded onOpen={onOpen}/></section>}
  </>}
  <details className="nw-scope"><summary>מה מחובר ומה עדיין בפיתוח?</summary><p>המסך הזה מחובר לנתוני התיקים המקומיים, ליומן הדמו ולמסכי המוצרים וההמלצות הקיימים. מייל, וואטסאפ, SMS 2010 ויומן עסקי חיצוני אינם מחוברים. חלק ממסלולי התפעול הקיימים עדיין דורשים התאמה ובדיקה מול האפיון מ־28.9; אין לראות בהם תהליך מאושר לעבודה חיה.</p><p>מועדים מחושבים בימים א׳–ה׳ ללא לוח חגים. אין לטעון מידע רגיש לצורך בדיקת הסנדבוקס; מיקום השמירה מוצג בסרגל העליון.</p></details>
 </div>;
}
