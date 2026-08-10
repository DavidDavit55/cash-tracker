import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [incomeStats, setIncomeStats] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [expandedCat, setExpandedCat] = useState(null);
  const [catExpenses, setCatExpenses] = useState({});
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  useEffect(() => {
    api.get(`/expenses/stats/summary?month=${month}&year=${year}`).then(r => setStats(r.data));
    api.get(`/incomes/stats/summary?month=${month}&year=${year}`).then(r => setIncomeStats(r.data));
    api.get(`/budgets?month=${month}&year=${year}`).then(r => setBudgets(r.data));
    setExpandedCat(null);
    setCatExpenses({});
  }, [month, year]);

  const toggleCat = useCallback(async (cat) => {
    if (expandedCat === cat.name) { setExpandedCat(null); return; }
    setExpandedCat(cat.name);
    if (!catExpenses[cat.name]) {
      const params = `month=${month}&year=${year}&limit=50`;
      const catParam = cat.id ? `&category_id=${cat.id}` : '&no_category=1';
      const { data } = await api.get(`/expenses?${params}${catParam}`);
      setCatExpenses(prev => ({ ...prev, [cat.name]: data }));
    }
  }, [expandedCat, catExpenses, month, year]);

  if (!stats) return <div className="loading">טוען...</div>;

  const totalSpent = parseFloat(stats.total?.total || 0);
  const totalIncome = parseFloat(incomeStats?.total?.total || 0);
  const cashflow = totalIncome - totalSpent;

  // מיזוג קטגוריות עם תקציבים
  const budgetMap = Object.fromEntries(budgets.map(b => [b.category_id, b]));
  const categoryData = stats.byCategory
    .map(c => {
      const b = budgetMap[c.id];
      return {
        id: c.id, name: c.name, total: parseFloat(c.total),
        color: c.color || '#6366f1', icon: c.icon,
        budget: b ? parseFloat(b.amount) : null,
      };
    })
    .sort((a, b) => b.total - a.total);

  const uncatTotal = parseFloat(stats.uncategorized?.total || 0);
  if (uncatTotal > 0) {
    categoryData.push({ id: null, name: 'ללא קטגוריה', total: uncatTotal, color: '#94a3b8', icon: '❓', budget: null });
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>שלום, {user?.name} 👋</h2>
        <div className="month-selector">
          <select value={month} onChange={e => setMonth(+e.target.value)}>
            {MONTHS_HE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="summary-card" style={{ background: cashflow >= 0 ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
        <div className="summary-amount" style={{ fontSize: '2rem' }}>
          {cashflow >= 0 ? '+' : ''}₪{cashflow.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </div>
        <div className="summary-label">תזרים — {MONTHS_HE[month - 1]} {year}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px', fontSize: '0.82rem', opacity: 0.9 }}>
          <span>⬆️ הכנסות ₪{totalIncome.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</span>
          <span>⬇️ הוצאות ₪{totalSpent.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      {/* קטגוריות + תקציב — accordion מאוחד */}
      {categoryData.length > 0 && (
        <div className="chart-card" style={{ padding: '14px 0' }}>
          <h3 style={{ padding: '0 16px 10px' }}>הוצאות לפי קטגוריה</h3>
          {categoryData.map((cat, i) => {
            const maxTotal = categoryData[0].total || 1;
            const hasBudget = cat.budget !== null;
            const over = hasBudget && cat.total > cat.budget;
            const barPct = hasBudget
              ? Math.min(100, (cat.total / cat.budget) * 100)
              : (cat.total / maxTotal) * 100;
            const barColor = over ? '#ef4444' : cat.color;
            const isOpen = expandedCat === cat.name;
            const expenses = catExpenses[cat.name] || [];
            return (
              <div key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <button onClick={() => toggleCat(cat)}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', fontSize: '0.84rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                      {isOpen ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                    </div>
                    <span style={{ fontWeight: 500, flex: 1, textAlign: 'right', margin: '0 6px' }}>{cat.icon} {cat.name}</span>
                    <span style={{ fontWeight: 700, color: over ? '#ef4444' : cat.color, whiteSpace: 'nowrap' }}>
                      ₪{cat.total.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                      {hasBudget && <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.78rem' }}> / ₪{cat.budget.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</span>}
                    </span>
                  </div>
                  <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barPct}%`, background: barColor, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                  </div>
                </button>

                {isOpen && (
                  <div style={{ background: '#f8fafc', paddingBottom: '4px' }}>
                    {expenses.length === 0 ? (
                      <div style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#94a3b8' }}>
                        {cat.total === 0 ? 'אין הוצאות החודש' : 'טוען...'}
                      </div>
                    ) : expenses.map((exp, j) => (
                      <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderTop: '1px solid #f1f5f9', fontSize: '0.82rem' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{exp.merchant || exp.description}</div>
                          <div style={{ color: '#94a3b8', marginTop: '2px', fontSize: '0.75rem' }}>
                            {exp.payment_method || ''}{exp.card_number ? ` •••• ${exp.card_number}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 700, color: '#ef4444' }}>₪{parseFloat(exp.amount).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</div>
                          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{new Date(exp.expense_date).toLocaleDateString('he-IL')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* מגמה חודשית */}
      {stats.monthly.length > 0 && (
        <div className="chart-card">
          <h3>מגמה חודשית</h3>
          <ResponsiveContainer width="100%" height={180} dir="ltr">
            <BarChart data={stats.monthly.map(m => ({ name: MONTHS_HE[m.month - 1], total: parseFloat(m.total) }))}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={v => `₪${v.toLocaleString('he-IL')}`} />
              <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
