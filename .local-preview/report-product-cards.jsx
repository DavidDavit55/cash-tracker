import React, { useState } from 'react';
import { showInsuranceAmount } from '../frontend/src/lib/insuranceDisplay.js';
import { ProductManagement } from './product-management.jsx';
import { classifyProduct } from './product-registry.js';

const logos = [['הראל','harel.svg'],['הפניקס','phoenix-user.png'],['מנורה','menora.png'],['מיטב','meitav.svg'],['כלל','clal.svg'],['מור','mor.svg'],['איילון','ayalon.png']];
export function Company({ name }) {
  const logo = logos.find(([label]) => name?.includes(label));
  const [failedLogo, setFailedLogo] = useState(null);
  const src = logo ? `/sandbox-insurers/${logo[1]}` : null;
  return <div className="nw-company">{src && failedLogo !== src ? <img src={src} alt={name} onError={() => setFailedLogo(src)}/> : <span>{name}</span>}</div>;
}
const amount = n => n == null ? 'לא דווח במקור' : n.toLocaleString('he-IL', {style:'currency',currency:'ILS',maximumFractionDigits:2});
export function ProductCards({ report }) {
  const groups = [['פנסיה וחיסכון',report.payload.pensionData || [],true],['ביטוחים', [...(report.payload.insuranceData || []),...(report.payload.harBituachData || [])],false]];
  return groups.filter(([,rows]) => rows.length).map(([title,rows,savings]) => <section className="nw-card-group" key={title}><h3>{title} <small>{rows.length} מוצרים</small></h3><div className="nw-card-grid">{rows.map((p,i) => <article className="nw-product-card" key={p.productKey || `${p.provider}-${p.id}-${i}`}>
    <Company name={p.provider}/><h4>{p.name}</h4>
    {(p.hasLien || p.hasPledge) && <p className="report-restriction">⚠ דווח {p.hasLien ? 'עיקול' : 'שעבוד'} — לפי תאריך הדוח</p>}
    <dl><div><dt>פוליסה / חשבון</dt><dd>{p.id}</dd></div>
    {savings ? <><div><dt>צבירה מדווחת</dt><dd>{amount(p.balance)}</dd></div><div><dt>הפקדה חודשית</dt><dd>{amount(p.monthlyDeposit)}</dd></div><div><dt>דמי ניהול מהפקדה / מצבירה</dt><dd>{p.feeFromDeposit == null ? '—' : p.feeFromDeposit+'%'} / {p.feeFromAccumulation == null ? '—' : p.feeFromAccumulation+'%'}</dd></div></> : <><div><dt>פרמיה חודשית</dt><dd>{amount(p.monthlyPremium)}</dd></div>{showInsuranceAmount(p) && <div><dt>סכום ביטוח</dt><dd>{amount(p.coverage > 0 ? p.coverage : null)}</dd></div>}</>}
    </dl><p className="nw-card-source">נתונים נכון ל־{new Date((p.asOf || report.as_of_date)+'T12:00:00').toLocaleDateString('he-IL')}</p>
    {!savings && p.coverageItems?.length > 0 && <details className="nw-card-coverages"><summary>כיסויים ({p.coverageItems.length})</summary><ul>{p.coverageItems.map((c,n) => <li key={n}>{c}</li>)}</ul></details>}
    <ProductManagement product={p}/>
  </article>)}</div></section>);
}
export function ClientTransitions({ maslaka, har }) {
  const pension = maslaka.payload.pensionData.filter(p => p.provider.includes('הראל'));
  const health = har.payload.harBituachData.map(classifyProduct).filter(p => p.provider.includes('הראל') && p.name === 'ביטוח בריאות');
  return <section className="nw-transitions"><div className="nw-case-summary"><strong>איפה הלקוח נמצא עכשיו?</strong><p>לפי אישורך: הפנסיה עברה מהראל להפניקס, והבריאות מהראל למנורה. הדוחות הישנים נשמרים כתמונת המקור; פרטי היעד והשלמת המעברים עדיין דורשים אימות מול מסמכים.</p></div>
    {[['פנסיה מקיפה',pension,'הפניקס',maslaka],['ביטוח בריאות',health,'מנורה מבטחים',har]].map(([title,products,target,report]) => <article className="nw-transition" key={title}><header><h2>{title} · מקור מול יעד</h2><span>דיווח הסוכן · ממתין לאימות מסמכים</span></header><div className="nw-transition-grid"><section><small>מקור · נשמר בהיסטוריה</small><Company name="הראל"/>{products.map(p => <div className="nw-origin-line" key={p.id}><strong>{p.name}</strong><span>פוליסה / חשבון {p.id}</span><span>{title.includes('פנסיה') ? `צבירה: ${amount(p.balance)}` : `פרמיה חודשית: ${amount(p.monthlyPremium)}`}</span></div>)}<p className="nw-card-source">נתונים נכון ל־{new Date(report.as_of_date+'T12:00:00').toLocaleDateString('he-IL')}</p></section><span className="nw-transition-arrow" aria-hidden="true">←</span><section className="nw-destination"><small>יעד · לפי אישור הסוכן</small><Company name={target}/><p>המעבר דווח על ידך; מספר היעד מקובץ קומישנס שסיפקת</p><dl><div><dt>מספר פוליסת יעד</dt><dd>{title.includes('פנסיה') ? '3480300080' : '372874297'}</dd></div><div><dt>{title.includes('פנסיה') ? 'כספים שהתקבלו / הפקדה ראשונה' : 'תחילת כיסוי / סיום כיסוי קודם'}</dt><dd>ממתין לאסמכתה</dd></div></dl><p className="nw-card-source">מספר יעד לפי קובץ קומישנס; קבלת כספים ותחילת כיסוי טרם אומתו. עמלות לא נכללו.</p></section></div></article>)}
    <p className="nw-transfer-note">אין ספירה כפולה של צבירה. מוצרים אחרים לא סומנו כמבוטלים בעקבות המעברים.</p>
  </section>;
}
