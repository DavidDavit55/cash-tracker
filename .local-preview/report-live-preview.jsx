import React, { useState } from 'react';
import { Users, LayoutDashboard, Wallet, FileText, ShieldCheck, ChevronLeft, Download, Search, TriangleAlert, CalendarDays, Landmark, FolderOpen, LockKeyhole, ArrowDownLeft } from 'lucide-react';
import './report-live-preview.css';
import { ProductCards, ClientTransitions } from './report-product-cards.jsx';
import { unifiedProducts } from './product-registry.js';

const day = value => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('he-IL');
const currency = value => value.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 });
const items = report => Object.values(report.payload).flat();

export default function ReportLivePreview({ reports, originals }) {
  const [query, setQuery] = useState('');
  const [warningsOnly, setWarningsOnly] = useState(false);
  const currentFor = key => reports.filter(r => r.source === key).sort((a,b)=>b.as_of_date.localeCompare(a.as_of_date))[0];
  const maslaka = currentFor('maslaka');
  const har = currentFor('har_bituach');
  const registry = unifiedProducts([maslaka, har]);
  const visible = registry;
  const current = {id:'unified',source:'unified',payload:{pensionData:visible.filter(p=>p.productField==='pensionData'),insuranceData:visible.filter(p=>p.productField!=='pensionData')}};
  const savings = maslaka.payload.pensionData;
  const balance = savings.reduce((total, p) => total + (p.balance || 0), 0);
  const warnings = items(current).filter(p => p.hasLien || p.hasPledge);
  const filtered = { ...current, payload: Object.fromEntries(Object.entries(current.payload).map(([key, products]) => [key, products.filter(p => (!warningsOnly || p.hasLien || p.hasPledge) && [p.name, p.provider, p.id].join(' ').includes(query.trim()))])) };
  return <div className="nw-preview" dir="rtl">
    <div className="nw-preview-note"><span className="nw-preview-dot"/> תצוגת עיצוב מקומית · נתוני המקור של אבי · ללא שמירה או שינוי באתר החי</div>
    <header className="nw-top"><div className="nw-wordmark">NET<span>WORTH</span><small>סביבת הסוכן</small></div><div className="nw-breadcrumb">לקוחות <ChevronLeft size={14}/> אבי אברהם בן חמו</div><div className="nw-user"><span className="nw-avatar">דד</span><div>דוד דויטשוילי<small>ניהול התיק הפיננסי</small></div></div></header>
    <aside className="nw-sidebar"><div className="nw-sidebar-label">סביבת עבודה</div><span><LayoutDashboard size={19}/> סקירה כללית</span><span className="nw-nav-active"><Users size={19}/> לקוחות</span><span><Wallet size={19}/> תזרים ותקציב</span><span><FileText size={19}/> מסמכים ודוחות</span><div className="nw-sidebar-foot"><LockKeyhole size={17}/><div>סביבת תצוגה מבודדת<small>התפריט להמחשת העיצוב בלבד</small></div></div></aside>
    <main className="nw-main">
      <div className="nw-client-head"><div className="nw-client-title"><div className="nw-client-avatar">אב</div><div><div className="nw-eyebrow">תיק לקוח / מוצרים ודוחות</div><h1>אבי אברהם בן חמו</h1><p>כל המוצרים והמעברים במקום אחד.</p></div></div><span className="nw-case-label"><FolderOpen size={16}/> סקירת תיק</span></div>
      <nav className="nw-client-tabs" aria-label="אזור בתיק"><span className="nw-current">התיק והמעברים</span><span>מסמכים <small>בהמשך</small></span></nav>
      <ClientTransitions maslaka={maslaka} har={har}/>
      <section className="nw-stats" aria-label="סיכום הדוחות שנבחרו">
        <article className="nw-stat nw-stat-primary"><div>חיסכון מדווח <Landmark size={19}/></div><strong>{currency(balance)}</strong><small>נתונים נכון ל־{day(maslaka.as_of_date)} · יתרה חסרה במוצר אחד</small></article>
        <article className="nw-stat"><div>מוצרי פנסיה וחיסכון <Wallet size={19}/></div><strong>{savings.length}<em>מוצרים</em></strong><small>כולל חשבונות עם יתרה אפסית או חסרה</small></article>
        <article className="nw-stat"><div>ביטוחים בתיק <ShieldCheck size={19}/></div><strong>{registry.filter(p=>p.productField!=='pensionData').length}<em>פוליסות ייחודיות</em></strong><small>ללא כפילויות</small></article>
      </section>
      <section className="nw-workspace">
        <div className="nw-workspace-head"><h2>כל המוצרים בתיק</h2></div>
        {warnings.length > 0 && <div className="nw-warning"><TriangleAlert size={21}/><div><strong>יש מוצר שדורש בדיקה</strong><span>דווח עיקול או שעבוד במקור. תאריך הדיווח מופיע במוצר; יש לברר את מצבו כיום.</span></div><button onClick={() => setWarningsOnly(v => !v)} aria-pressed={warningsOnly}>{warningsOnly ? 'הצג את כל המוצרים' : 'הצג מוצר עם אזהרה'}<ArrowDownLeft size={16}/></button></div>}
        <div className="nw-table-toolbar"><label><Search size={17}/><input aria-label="חיפוש מוצר" placeholder="חיפוש לפי חברה, מוצר או מספר פוליסה" value={query} onChange={e => setQuery(e.target.value)}/></label><span aria-live="polite">{items(filtered).length} מתוך {items(current).length} מוצרים ללא כפילות</span></div>
        <div className="nw-products"><ProductCards report={filtered}/>{!items(filtered).length&&<p className="nw-empty">לא נמצאו מוצרים התואמים לחיפוש.</p>}</div>
        <footer className="nw-report-foot"><CalendarDays size={15}/> נתוני כל מוצר מוצגים לפי התאריך המצוין בו.</footer>
      </section>
      <p className="nw-bottom-note">NETWORTH · תצוגה מקומית</p>
    </main>
  </div>;
}
