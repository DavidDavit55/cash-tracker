import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Pencil, Check, X } from 'lucide-react';
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
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState('');

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
    // נקה קאש הוצאות כולו — יטען מחדש בפתיחה הבאה
    setExpenses({});
    setExpanded(null);
    await load();
  };

  const saveEdit = async (b) => {
    if (!editAmount || isNaN(editAmount)) return;
    await api.put(`/budgets/${b.id}`, { category_id: b.category_id, amount: parseFloat(editAmount), month, year });
    setEditingId(null);
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

      {budgets.length > 0 && (() => {
        const totalBudget = budgets.reduce((s, b) => s + parseFloat(b.amount), 0);
        const totalSpent = budgets.reduce((s, b) => s + parseFloat(b.spent), 0);
        const over = totalSpent > totalBudget;
        return (
          <div className="summary-card" style={{ background: over ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', marginBottom: '12px' }}>
            <div className="summary-amount">₪{totalSpent.toLocaleString('he-IL', { maximumFractionDigits: 0 })} / ₪{totalBudget.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</div>
            <div className="summary-label">סה"כ הוצאות מתוך תקציב</div>
            <div style={{ marginTop: '6px', fontSize: '0.85rem', opacity: 0.9 }}>
              {over ? `חריגה של ₪${(totalSpent - totalBudget).toLocaleString('he-IL', { maximumFractionDigits: 0 })}` : `נותר ₪${(totalBudget - totalSpent).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`}
            </div>
          </div>
        );
      })()}

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
                <div className="budget-header" onClick={() => editingId !== b.id && toggleExpand(b)} style={{ cursor: 'pointer' }}>
                  <span className="budget-cat">{b.icon} {b.category_name}</span>
                  <div className="budget-amounts">
                    <span className={over ? 'over-budget' : ''}>₪{spent.toFixed(0)}</span>
                    <span className="budget-sep"> / </span>
                    {editingId === b.id ? (
                      <span onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          autoFocus
                          style={{ width: '80px', padding: '2px 6px', borderRadius: '6px', border: '1px solid #6366f1', fontSize: '0.85rem', textAlign: 'center' }}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(b); if (e.key === 'Escape') setEditingId(null); }}
                        />
                        <button className="icon-btn" onClick={() => saveEdit(b)}><Check size={14} color="#22c55e"/></button>
                        <button className="icon-btn" onClick={() => setEditingId(null)}><X size={14} color="#ef4444"/></button>
                      </span>
                    ) : (
                      <span>₪{budget.toFixed(0)}</span>
                    )}
                    <button className="icon-btn" onClick={e => { e.stopPropagation(); setEditingId(b.id); setEditAmount(budget.toFixed(0)); }}><Pencil size={13}/></button>
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
