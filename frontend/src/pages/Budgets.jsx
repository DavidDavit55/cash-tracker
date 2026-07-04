import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api/client';

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function Budgets() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category_id: '', amount: '' });
  const [expanded, setExpanded] = useState(null);
  const [expenses, setExpenses] = useState({});

  const load = async () => {
    const [bRes, cRes] = await Promise.all([
      api.get(`/budgets?month=${month}&year=${year}`),
      api.get('/categories'),
    ]);
    setBudgets(bRes.data);
    setCategories(cRes.data);
  };

  useEffect(() => { load(); setExpanded(null); setExpenses({}); }, [month, year]);

  const toggleExpand = async (b) => {
    if (expanded === b.id) { setExpanded(null); return; }
    setExpanded(b.id);
    if (!expenses[b.id]) {
      const res = await api.get(`/expenses?month=${month}&year=${year}&category_id=${b.category_id}&limit=500`);
      setExpenses(prev => ({ ...prev, [b.id]: res.data }));
    }
  };

  const changeCategory = async (budgetId, expenseId, newCatId) => {
    await api.patch(`/expenses/${expenseId}`, { category_id: newCatId });
    // הסר מהרשימה הנוכחית
    setExpenses(prev => ({
      ...prev,
      [budgetId]: prev[budgetId].filter(e => e.id !== expenseId),
    }));
    // רענן תקציבים
    load();
  };

  const save = async e => {
    e.preventDefault();
    await api.post('/budgets', { ...form, month, year });
    setForm({ category_id: '', amount: '' });
    setShowForm(false);
    load();
  };

  const remove = async id => {
    await api.delete(`/budgets/${id}`);
    setBudgets(prev => prev.filter(b => b.id !== id));
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>תקציבים</h2>
        <button className="btn-fab" onClick={() => setShowForm(true)}>+ הוסף</button>
      </div>

      <div className="filters-row">
        <select value={month} onChange={e => setMonth(+e.target.value)}>
          {MONTHS_HE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(+e.target.value)}>
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <h3>הגדר תקציב</h3>
            <form onSubmit={save}>
              <div className="form-group">
                <label>קטגוריה</label>
                <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))} required>
                  <option value="">בחר קטגוריה</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>סכום תקציב (₪)</label>
                <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required min="1" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>ביטול</button>
                <button type="submit" className="btn-primary">שמור</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {budgets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <p>אין תקציבים מוגדרים לחודש זה</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>הגדר תקציב ראשון</button>
        </div>
      ) : (
        <div className="card">
          {budgets.map(b => {
            const spent = parseFloat(b.spent);
            const budget = parseFloat(b.amount);
            const pct = Math.min(100, (spent / budget) * 100);
            const over = spent > budget;
            const isOpen = expanded === b.id;
            const catExpenses = expenses[b.id] || [];

            return (
              <div key={b.id} className="budget-card">
                <div className="budget-header" onClick={() => toggleExpand(b)} style={{ cursor: 'pointer' }}>
                  <span className="budget-cat">{b.icon} {b.category_name}</span>
                  <div className="budget-amounts">
                    <span className={over ? 'over-budget' : ''}>₪{spent.toFixed(0)}</span>
                    <span className="budget-sep"> / </span>
                    <span>₪{budget.toFixed(0)}</span>
                    <button className="icon-btn danger" onClick={e => { e.stopPropagation(); remove(b.id); }}><Trash2 size={14}/></button>
                    {isOpen ? <ChevronUp size={16} style={{ color: '#94a3b8' }} /> : <ChevronDown size={16} style={{ color: '#94a3b8' }} />}
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: over ? '#ef4444' : b.color || '#6366f1' }} />
                </div>
                <div className="budget-remaining">
                  {over
                    ? `חרגת ב-₪${(spent - budget).toFixed(0)}`
                    : `נותר ₪${(budget - spent).toFixed(0)}`}
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '8px', paddingTop: '8px' }}>
                    {catExpenses.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', padding: '8px' }}>אין הוצאות</div>
                    ) : catExpenses.map(e => (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f8fafc', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.merchant || e.description}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {e.expense_date?.split('T')[0]}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                          ₪{parseFloat(e.amount).toFixed(0)}
                        </div>
                        <select
                          defaultValue={b.category_id}
                          onChange={ev => changeCategory(b.id, e.id, ev.target.value)}
                          style={{ fontSize: '0.72rem', padding: '2px 4px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', maxWidth: '110px' }}
                        >
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
