import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  useEffect(() => {
    api.get(`/expenses/stats/summary?month=${month}&year=${year}`).then(r => setStats(r.data));
    api.get(`/budgets?month=${month}&year=${year}`).then(r => setBudgets(r.data));
  }, [month, year]);

  if (!stats) return <div className="loading">טוען...</div>;

  const totalSpent = parseFloat(stats.total?.total || 0);

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

      <div className="summary-card">
        <div className="summary-amount">₪{totalSpent.toLocaleString('he-IL', { minimumFractionDigits: 2 })}</div>
        <div className="summary-label">סה"כ הוצאות — {MONTHS_HE[month - 1]} {year}</div>
        <div className="summary-count">{stats.total?.count || 0} עסקאות</div>
      </div>

      {/* גרף עמודות אופקיות לפי קטגוריה */}
      {categoryData.length > 0 && (
        <div className="chart-card">
          <h3>פילוח לפי קטגוריה</h3>
          <ResponsiveContainer width="100%" height={categoryData.length * 38 + 20} dir="ltr">
            <BarChart
              data={categoryData}
              layout="vertical"
              margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, textAnchor: 'start', dx: -10 }}
                width={120}
                mirror
              />
              <Tooltip
                formatter={v => [`₪${parseFloat(v).toLocaleString('he-IL', { minimumFractionDigits: 0 })}`, '']}
                labelFormatter={l => l}
              />
              <Bar dataKey="total" radius={[0, 6, 6, 0]} label={{ position: 'right', formatter: v => `₪${Math.round(v).toLocaleString('he-IL')}`, fontSize: 11 }}>
                {categoryData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
