import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [incomeStats, setIncomeStats] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  useEffect(() => {
    api.get(`/expenses/stats/summary?month=${month}&year=${year}`).then(r => setStats(r.data));
    api.get(`/incomes/stats/summary?month=${month}&year=${year}`).then(r => setIncomeStats(r.data));
    api.get(`/budgets?month=${month}&year=${year}`).then(r => setBudgets(r.data));
  }, [month, year]);

  if (!stats) return <div className="loading">טוען...</div>;

  const totalSpent = parseFloat(stats.total?.total || 0);
  const totalIncome = parseFloat(incomeStats?.total?.total || 0);
  const cashflow = totalIncome - totalSpent;

  const categoryData = stats.byCategory
    .map(c => ({ name: c.name, total: parseFloat(c.total), color: c.color || '#6366f1', icon: c.icon }))
    .sort((a, b) => b.total - a.total);

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

      {/* פילוח לפי קטגוריה — CSS bars */}
      {categoryData.length > 0 && (
        <div className="chart-card">
          <h3>פילוח לפי קטגוריה</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
            {categoryData.map((cat, i) => {
              const pct = (cat.total / categoryData[0].total) * 100;
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.82rem' }}>
                    <span style={{ fontWeight: 500 }}>{cat.icon} {cat.name}</span>
                    <span style={{ fontWeight: 700, color: cat.color }}>₪{cat.total.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: cat.color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
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

      {/* תקציבים */}
      {budgets.length > 0 && (
        <div className="card">
          <h3 style={{ padding: '14px 16px 0' }}>תקציבים</h3>
          {budgets.map(b => {
            const pct = Math.min(100, (parseFloat(b.spent) / parseFloat(b.amount)) * 100);
            const over = parseFloat(b.spent) > parseFloat(b.amount);
            return (
              <div key={b.id} className="budget-row" style={{ padding: '10px 16px' }}>
                <div className="budget-info">
                  <span>{b.icon} {b.category_name}</span>
                  <span className={over ? 'over-budget' : ''}>₪{parseFloat(b.spent).toFixed(0)} / ₪{parseFloat(b.amount).toFixed(0)}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: over ? '#ef4444' : b.color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
