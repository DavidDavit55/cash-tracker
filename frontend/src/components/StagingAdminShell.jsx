import React,{useRef,useState} from 'react';
import WorkflowDemo from '../../../.local-preview/workflow-demo.jsx';
import PreviewBudgetWorkspace from '../pages/PreviewBudgetWorkspace';
import {Home,Users,ListChecks,Wallet,Mail,CalendarDays,Files,ChartNoAxesCombined} from 'lucide-react';
import '../admin-existing-preview.css';

function Construction({size=72,...props}){
 return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M18 43V8h6v35M13 43h16M5 14h38v6H5zM18 8l6-5 19 11M18 8 5 14M18 20l6 7-6 7 6 9M24 20l-6 7 6 7-6 9M9 14l6 6 6-6 6 6 6-6 6 6M38 20v12m0 0v3a3 3 0 1 1-6 0"/></svg>;
}

export default function StagingAdminShell({banner='סביבת בדיקה · העיצוב החדש · נתוני וחיבורי הסטייג׳ינג',budgetContent,...props}){
 const [section,setSection]=useState('היום שלי');const workflow=useRef(null);
 const navigation=[['היום שלי',Home],['לקוחות',Users],['משימות',ListChecks],['התקציב שלי',Wallet],['מיילים',Mail],['יומן עסקי',CalendarDays],['תביעות',Files],['תמונת העסק',ChartNoAxesCombined]];
 function go(name){setSection(name);if(['התקציב שלי','תביעות','תמונת העסק'].includes(name))return;const target=name==='משימות'?'היום שלי':name==='מיילים'?'תיבת עדכונים':name;[...workflow.current.querySelectorAll('.wf-sidebar>button')].find(b=>b.textContent===target)?.click();}
 return <div className="unified-preview" dir="rtl"><div className="existing-preview-banner">{banner}</div><aside className="unified-nav"><strong className="unified-brand">NETWORTH</strong><small>סביבת ניהול</small><nav>{navigation.map(([name,Icon])=><button key={name} aria-current={section===name?'page':undefined} onClick={()=>go(name)}><Icon size={19}/>{name==='היום שלי'?'לוח מחוונים לבעלים':name}</button>)}</nav></aside><div className="unified-content"><div ref={workflow} hidden={['התקציב שלי','תביעות','תמונת העסק'].includes(section)}><WorkflowDemo {...props} onNavigate={setSection} previewShell previewBusinessDashboard={section==='היום שלי'}/></div><div hidden={section!=='התקציב שלי'} className="unified-budget">{budgetContent??<PreviewBudgetWorkspace showLegacyLinks={false}/>}</div>{['תביעות','תמונת העסק'].includes(section)&&<section className="unified-claims"><h1>{section}</h1><div className="claims-construction"><Construction size={72} strokeWidth={1.4} aria-hidden="true"/><h2>בבנייה</h2>{section==='תמונת העסק'&&<p>כאן ירוכז כל מה שקיים כיום בקומישנס. החיבור עדיין בבנייה.</p>}</div></section>}</div></div>;
}
