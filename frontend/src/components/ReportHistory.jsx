import { Fragment, useEffect, useId, useState } from 'react';
import api from '../api/client';
import { reportProducts } from '../lib/reportMetadata';
import { showInsuranceAmount } from '../lib/insuranceDisplay';
import './ReportHistory.css';

const sources = { maslaka: 'מסלקה', har_bituach: 'הר הביטוח' };
const date = value => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('he-IL') : 'לא ידוע';
const money = value => value == null ? '—' : Number(value).toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 });

export function ReportProducts({ report }) {
  const [expanded, setExpanded] = useState({});
  const regionId = useId();
  const data = report?.payload || {};
  const insurance = [...(data.insuranceData || []), ...(data.harBituachData || [])];
  const hasSavings = p => p.type === 'managers' || p.balance != null;
  const groups = [
    { key: 'savings', title: 'פנסיה וחיסכון', rows: data.pensionData || [], savings: true },
    { key: 'insurance', title: 'ביטוחי סיכון', rows: insurance.filter(p => !hasSavings(p)), insurance: true },
    { key: 'combined', title: 'ביטוח עם רכיב חיסכון', rows: insurance.filter(hasSavings), savings: true, insurance: true },
  ];
  return groups.filter(g => g.rows.length).map(group => {
    const totalKey = group.savings ? 'balance' : 'monthlyPremium';
    const known = group.rows.filter(p => p[totalKey] != null);
    const total = known.length ? known.reduce((sum, p) => sum + Number(p[totalKey]), 0) : null;
    return <section key={group.key} data-report-group={group.key}>
      <h4>{group.title} ({group.rows.length})</h4>
      <p>{group.savings ? 'צבירה מדווחת' : 'פרמיות מדווחות לחודש'}: {money(total)}{known.length < group.rows.length ? ' · נתונים חלקיים' : ''}</p>
      <div className="report-table-wrap"><table className="report-table"><thead><tr><th>חברה</th><th>מוצר</th><th>פוליסה / חשבון</th>
        {group.savings && <><th>צבירה</th><th>הפקדה חודשית</th><th>דמי ניהול מהפקדה</th><th>דמי ניהול מצבירה</th></>}
        {group.insurance && <><th>פרמיה חודשית</th><th>סכום ביטוח</th><th>כיסויים</th></>}
      </tr></thead><tbody>{group.rows.map((p, i) => {
        const key = `${report.id || report.source || ''}-${group.key}-${p.provider}-${p.id}-${i}`;
        const open = !!expanded[key];
        const panelId = `${regionId}-${group.key}-${i}`;
        return <Fragment key={key}><tr><td>{p.provider}</td><td>{p.name}
        {p.hasLien === true && <span className="report-restriction" title="עיקול דווח במקור לפי תאריך הדוח שנבחר; יש לבדוק את מצבו כיום"><span aria-hidden="true">⚠</span> דווח עיקול — לפי תאריך הדוח</span>}
        {p.hasPledge === true && <span className="report-restriction" title="שעבוד דווח במקור לפי תאריך הדוח שנבחר; יש לבדוק את מצבו כיום"><span aria-hidden="true">⚠</span> דווח שעבוד — לפי תאריך הדוח</span>}
      </td><td>{p.id}</td>
        {group.savings && <><td>{money(p.balance)}</td><td>{money(p.monthlyDeposit)}</td><td>{p.feeFromDeposit == null ? '—' : `${p.feeFromDeposit}%`}</td><td>{p.feeFromAccumulation == null ? '—' : `${p.feeFromAccumulation}%`}</td></>}
        {group.insurance && <><td>{money(p.monthlyPremium)}</td><td>{!showInsuranceAmount(p) ? '—' : p.coverage > 0 ? money(p.coverage) : 'לא דווח במקור'}</td><td>{p.coverageItems?.length ? <button type="button" className="report-coverage-toggle" aria-expanded={open} aria-controls={panelId} aria-label={`${open ? 'סגירת' : 'הצגת'} כיסויים לפוליסה ${p.id}`} onClick={() => setExpanded(s => ({ ...s, [key]: !s[key] }))}><span aria-hidden="true">{open ? '▾' : '▸'}</span> {open ? 'סגירה' : `כיסויים (${p.coverageItems.length})`}</button> : '—'}</td></>}
      </tr>{group.insurance && open && <tr className="report-coverage-row"><td colSpan={3 + (group.savings ? 4 : 0) + 3}><div id={panelId} className="report-coverage-panel" role="region" aria-label={`כיסויים לפוליסה ${p.id}`}><h5>פירוט כיסויים · פוליסה {p.id}</h5><ul>{p.coverageItems.map((c, n) => <li key={n}>{c}</li>)}</ul></div></td></tr>}</Fragment>;
      })}</tbody></table></div>
    </section>;
  });
}

export default function ReportHistory({ clientId, revision = 0 }) {
  const [reports, setReports] = useState([]);
  const [selection, setSelection] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setReports([]); setSelection({});
    api.get(`/admin/clients/${clientId}/reports`).then(({ data }) => {
      if (!cancelled) setReports(data);
    }).catch(() => { if (!cancelled) setError('טעינת היסטוריית הדוחות נכשלה. רענן ונסה שוב.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientId, revision]);

  async function download(report) {
    try {
      const { data } = await api.get(`/admin/clients/${clientId}/reports/${report.id}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a'); a.href = url; a.download = report.filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('הורדת הקובץ נכשלה'); }
  }

  return <section className="card report-history" dir="rtl"><h3>דוחות לפי תאריך</h3>
    <p>צפייה בדוחות שנשמרו. בחירת תאריך אינה משנה את התיק הנוכחי או את ההמלצות.</p>
    {loading && <p role="status">טוען דוחות…</p>}{error && <p role="alert">{error}</p>}
    {!loading && !error && !reports.length && <p>טרם נשמרו דוחות היסטוריים. נתונים שיובאו בעבר נשארו בתיק הנוכחי; לא הומצאו להם תאריכי דוח.</p>}
    {Object.entries(sources).map(([source, label]) => {
      const options = reports.filter(r => r.source === source);
      const current = options.find(r => r.id === selection[source]) || options[0];
      if (!current) return null;
      const products = reportProducts(current);
      return <section key={source} className="report-source"><label>{label} — נתונים נכון ל־
        <select aria-label={`תאריך ${label}`} value={current.id} onChange={e => setSelection(s => ({ ...s, [source]: e.target.value }))}>
          {options.map(r => <option key={r.id} value={r.id}>{date(r.as_of_date)}</option>)}
        </select></label>
        <p className="report-notice">תמונת מצב היסטורית: {date(current.as_of_date)} — לא בהכרח המצב היום</p>
        <button type="button" onClick={() => download(current)}>הורדת קובץ המקור</button>
        <p>{products.length} מוצרים בדוח</p>
        <ReportProducts report={current} />
      </section>;
    })}
  </section>;
}
