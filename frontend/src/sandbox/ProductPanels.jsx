import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { money, percent } from './model';

const missing = 'לא התקבל';
const coverageMoney = value => value == null ? missing : value.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 });

export function DepositsPanel({ fund, demo }) {
  // History is explicit data, never inferred from the legacy monthlyDeposit field.
  const [basis, setBasis] = useState('salary');
  const data = fund.detailData || {};
  const deposits = (basis === 'salary' ? data.deposits : data.receivedDeposits) || [];
  return <section className="deposit-panel sb-deposits-panel">
    <div className="spread"><div><span>סכום צבירה כולל</span><strong className="big-amount">{money(fund.balance)}</strong></div><div><h3><TrendingUp size={18} /> הפקדות אחרונות</h3><p>תאריך הפקדה אחרון<br /><b>{fund.detailData?.lastDepositDate || missing}</b></p></div></div>
    <label className="sb-deposit-basis">הצגת הפקדות לפי <select aria-label="בסיס גרף הפקדות" value={basis} onChange={event => setBasis(event.target.value)}><option value="salary">חודש שכר</option><option value="received">חודש קליטה</option></select></label>
    {deposits.length ? <div className="deposit-chart" dir="ltr"><ResponsiveContainer width="100%" height="100%"><BarChart data={deposits} margin={{ top: 15, right: 12, bottom: 10 }}><CartesianGrid vertical={false} stroke="#ffffff22" /><XAxis dataKey="month" stroke="#e3ece5" axisLine={false} tickLine={false} angle={-45} textAnchor="end" height={48} tick={{ fontSize: 12 }} /><YAxis stroke="#e3ece5" axisLine={false} tickLine={false} width={52} tick={{ fontSize: 12 }} /><Tooltip formatter={value => [money(value), 'הפקדה']} contentStyle={{ color: '#173f35', borderRadius: 12 }} cursor={{ fill: '#ffffff10' }} /><Bar dataKey="amount" radius={[7, 7, 7, 7]} maxBarSize={24}>{deposits.map((entry, index) => <Cell key={`${entry.month}-${index}`} fill={index % 2 ? '#60796c' : '#e3ece5'} />)}</Bar></BarChart></ResponsiveContainer></div> : <div className="sb-deposits-empty"><TrendingUp size={34} /><strong>פירוט ההפקדות טרם זמין</strong><p>הגרף יוצג לאחר אימות סכומי ההפקדות והתאריכים בקובץ המסלקה.</p></div>}
    <small className="sb-deposits-caption">{demo ? 'נתוני הדגמה בלבד' : 'סכום רכיבי ההפקדה שדווחו בקובץ, ללא ניודים. חודש חסר אינו אפס; ההיסטוריה מוגבלת לתקופות שבקובץ.'}</small>
    {data.transferTotal > 0 && <p className="sb-transfer-note">העברות מקופות אחרות: <strong>{money(data.transferTotal)}</strong><br />מוצגות בנפרד ואינן הפקדה חודשית.</p>}
    {data.otherTotal !== 0 && data.otherTotal != null && <p className="sb-transfer-note">תנועות ללא חודש שכר: {money(data.otherTotal)} — אינן נכללות בגרף.</p>}
    {data.invalidRows > 0 && <p className="sb-transfer-note">{data.invalidRows} רשומות ללא סכום תקין לא נכללו.</p>}
    {deposits.length > 0 && <details className="sb-deposit-table"><summary>פירוט ההפקדות ({deposits.length} חודשים)</summary><table><thead><tr><th>{basis === 'salary' ? 'חודש שכר' : 'חודש קליטה'}</th><th>סכום מדויק</th><th>תאריכי קליטה</th></tr></thead><tbody>{deposits.map(row => <tr key={row.key || row.month}><td>{row.month}</td><td>{row.amount.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}</td><td>{row.dates?.join(', ') || 'נתוני הדגמה'}</td></tr>)}</tbody></table></details>}
  </section>;
}

export function DisabilityPanel({ fund }) {
  const data = fund.detailData?.disability;
  return <section className="panel coverage sb-coverage-panel"><h3>קצבאות במקרה נכות</h3><dl><div><dt>שיעור כיסוי</dt><dd>{percent(data?.rate)}</dd></div><div><dt>קצבה חודשית</dt><dd>{coverageMoney(data?.pension)}</dd></div><div><dt>עלות חודשית</dt><dd>{coverageMoney(data?.cost)}</dd></div></dl>{!data && <p className="sb-source-note">פירוט הכיסוי טרם התקבל במבנה הנתונים המחובר.</p>}</section>;
}

export function SurvivorsPanel({ fund, compact = false }) {
  const data = fund.detailData?.survivors;
  return <section className={`panel survivors sb-survivors-panel${compact ? ' sb-survivors-compact' : ''}`}><div className="spread"><h3>עלות כיסוי שאירים</h3><span>{coverageMoney(data?.cost)}</span></div><div className="stat-grid">{[['אלמן/ה', data?.spouse], ['יתום/ה', data?.orphan]].map(([title, item]) => <div key={title}><p>{title}</p><dl><div><dt>שיעור מהשכר הקובע</dt><dd>{percent(item?.rate)}</dd></div><div><dt>קצבה חודשית</dt><dd>{coverageMoney(item?.pension)}</dd></div></dl></div>)}</div>{!data && <p className="sb-source-note">פירוט הכיסוי טרם התקבל במבנה הנתונים המחובר.</p>}</section>;
}
