import { useState } from 'react';
import { request } from './api';
import { money, number } from './model';
import { RefreshCw, Plus, FlaskConical } from 'lucide-react';

const initial = { expenses: [], incomes: [], budgets: [], categories: [] };
export default function Cashflow({ auth, snapshot }) {
  const [data, setData] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [local, setLocal] = useState([]);
  const [draft, setDraft] = useState({ type: 'expense', amount: '', description: '' });
  const load = async () => {
    setBusy(true); setError(''); setData(initial); setLoaded(false); setLocal([]);
    try {
      const [year, m] = month.split('-');
      const query = `?year=${year}&month=${Number(m)}`;
      const [expenses, incomes, budgets, categories] = await Promise.all([
        request(`/expenses${query}&limit=500`), request(`/incomes${query}`), request(`/budgets${query}`), request('/categories'),
      ]);
      setData({ expenses, incomes, budgets, categories }); setLoaded(true);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const expenses = [...data.expenses, ...local.filter(i => i.type === 'expense')];
  const incomes = [...data.incomes, ...local.filter(i => i.type === 'income')];
  const expenseTotal = expenses.reduce((s, i) => s + (number(i.amount) || 0), 0);
  const incomeTotal = incomes.reduce((s, i) => s + (number(i.amount) || 0), 0);
  const canLoad = auth && snapshot.source === 'live' && !snapshot.clientId;
  return <><section className="sb-safety"><FlaskConical /><div><strong>תזרים ותקציב — קריאה וניסוי מקומי</strong><p>ה־API הקיים מחזיר תנועות של המשתמש המחובר בלבד. בחירת לקוח מנהל אינה מקנה גישה לתזרים שלו.</p></div></section><div className="sb-cashflow-controls"><label>חודש<input type="month" value={month} disabled={busy} onChange={e => { setMonth(e.target.value); setData(initial); setLoaded(false); setLocal([]); }} /></label><button className="primary" disabled={!canLoad || busy || !month} onClick={load}><RefreshCw size={16} />{busy ? 'טוען…' : 'טעינת תנועות מהחשבון שלי'}</button>{!canLoad && <small>כדי לטעון תנועות, התחבר ובחר ״התיק שלי״ בחיבור הנתונים.</small>}</div>{error && <p role="alert" className="sb-error">{error}</p>}
    <div className="sb-kpis">{[['הכנסות שהוצגו', incomeTotal], ['הוצאות שהוצגו', expenseTotal], ['הפרש', incomeTotal - expenseTotal]].map(([label, value]) => <section className="panel" key={label}><span>{label}</span><strong>{loaded || local.length ? money(value) : 'טרם נטען'}</strong></section>)}</div>
    <div className="sb-data-grid"><section className="panel sb-source-card"><h2>תנועות</h2><p className="sb-source-note">מוצגות עד 500 הוצאות בחודש הנבחר. הסכומים מסכמים את הרשימה המוצגת.</p><div className="sb-table-wrap"><table><thead><tr><th>תיאור</th><th>סוג</th><th>סכום</th></tr></thead><tbody>{[...incomes.map(i => ({ ...i, kind: 'הכנסה' })), ...expenses.map(i => ({ ...i, kind: 'הוצאה' }))].map((item, i) => <tr key={`${item.kind}-${item.id || i}`}><td>{item.description || item.merchant || item.source || 'תנועה'}{item.local && <small>ניסוי מקומי</small>}</td><td>{item.kind}</td><td>{money(item.amount)}</td></tr>)}</tbody></table>{!expenses.length && !incomes.length && <p className="sb-empty-small">{loaded ? 'אין תנועות בחודש הנבחר' : 'לא נטענו תנועות'}</p>}</div></section>
    <section className="panel sb-source-card"><h2>תקציב וקטגוריות</h2>{data.budgets.map((budget, i) => <div className="sb-budget" key={budget.id || i}><div className="spread"><span>{budget.category_name}</span><span>{money(budget.spent)} / {money(budget.amount)}</span></div><progress max={Math.max(number(budget.amount) || 1, number(budget.spent) || 0)} value={number(budget.spent) || 0} /></div>)}{!data.budgets.length && <p className="sb-empty-small">{loaded ? 'לא הוגדר תקציב לחודש הזה' : 'תקציבים יוצגו לאחר הטעינה'}</p>}<div className="sb-category-tags">{data.categories.map(c => <span key={c.id}>{c.name}</span>)}</div></section></div>
    <form className="panel sb-local-form" onSubmit={e => { e.preventDefault(); if (!(number(draft.amount) > 0)) return; setLocal([...local, { ...draft, local: true, id: `local-${Date.now()}` }]); setDraft({ ...draft, amount: '', description: '' }); }}><div><h2>ניסוי של תנועה חדשה</h2><p>נשמר בזיכרון המסך בלבד; לא נשלח לשרת.</p></div><select aria-label="סוג תנועה" value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}><option value="expense">הוצאה</option><option value="income">הכנסה</option></select><input required placeholder="תיאור" aria-label="תיאור תנועה" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /><input required type="number" min="0.01" step="0.01" placeholder="סכום" aria-label="סכום תנועה" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} /><button className="primary" disabled={busy}><Plus size={15} />הוספה לניסוי</button></form></>;
}
