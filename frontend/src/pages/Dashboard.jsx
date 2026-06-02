import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
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

      {stats.byCategory.length > 0 && (
        <div className="chart-card">
          <h3>פילוח לפי קטגוריה</h3>
          <ResponsiveContainer width="100%" height={220} dir="ltr">
            <PieChart>
              <Pie data={stats.byCategory.map(c => ({ ...c, total: parseFloat(c.total) }))} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {stats.byCategory.map((entry, i) => (
                  <Cell key={i} fill={entry.color || '#6366f1'} />
                ))}
              </Pie>
              <Tooltip formatter={v => `₪${parseFloat(v).toLocaleString('he-IL', { minimumFractionDigits: 2 })}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {stats.monthly.length > 0 && (
        <div className="chart-card">
          <h3>מגמה חודשית</h3>
          <ResponsiveContainer width="100%" height={180} dir="ltr">
            <BarChart data={stats.monthly.map(m => ({ name: MONTHS_HE[m.month - 1], total: parseFloat(m.total) }))}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => `₪${v.toLocaleString('he-IL')}`} />
              <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {budgets.length > 0 && (
        <div className="card">
          <h3>תקציבים</h3>
          {budgets.map(b => {
            const pct = Math.min(100, (parseFloat(b.spent) / parseFloat(b.amount)) * 100);
            const over = parseFloat(b.spent) > parseFloat(b.amount);
            return (
              <div key={b.id} className="budget-row">
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

      {stats.byCategory.length > 0 && (
        <div className="card">
          <h3>לפי קטגוריה</h3>
          {stats.byCategory.map((cat, i) => (
            <div key={i} className="category-row">
              <span className="cat-icon">{cat.icon}</span>
              <span className="cat-name">{cat.name}</span>
              <span className="cat-amount">₪{parseFloat(cat.total).toLocaleString('he-IL', { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
