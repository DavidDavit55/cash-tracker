import React,{useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import PreviewBudgetWorkspace from './pages/PreviewBudgetWorkspace';
import api from './api/client';
import './admin-existing-preview.css';
api.defaults.adapter=async()=>{throw Error('Read only');};
const blocked=async()=>{throw Error('Read only');};
const readOnlyApi={get:async()=>{const r=await fetch('/private-budget-snapshot');if(!r.ok)throw Error('Snapshot unavailable');return {data:await r.json()};},post:blocked,patch:blocked,put:blocked,delete:blocked};
function App(){
 useEffect(()=>{const lock=()=>{document.querySelectorAll('.bw input[type="month"],.bw table select').forEach(e=>e.disabled=true);document.querySelectorAll('.bw button').forEach(e=>{if(/^(עריכה|עריכת תקציב|הגדרת תקציב|העלאת נתונים|＋ תנועת מזומן)$/.test(e.textContent.trim()))e.hidden=true;});};const observer=new MutationObserver(lock);observer.observe(document.getElementById('root'),{childList:true,subtree:true});lock();return()=>observer.disconnect();},[]);
 return <div className="unified-preview" dir="rtl"><div className="existing-preview-banner">נתוני אוקטובר 2026 מהלייב · עותק מקומי לקריאה בלבד · אין שינוי בלייב או בסטייג׳ינג</div><aside className="unified-nav"><strong className="unified-brand">NETWORTH</strong><small>תצוגת נתונים בלבד</small><nav><button aria-current="page">התקציב שלי</button></nav></aside><div className="unified-content"><div className="unified-budget"><PreviewBudgetWorkspace apiClient={readOnlyApi} initialPeriod="2026-10" showLegacyLinks={false}/></div></div></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
