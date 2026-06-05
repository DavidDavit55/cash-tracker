import { useState, useEffect, useRef } from 'react';
import { Trash2, Edit2, Search, Filter, Camera } from 'lucide-react';
import api from '../api/client';
import AddExpenseModal from '../components/AddExpenseModal';
import { format } from 'date-fns';

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [exRes, catRes] = await Promise.all([
      api.get(`/expenses?month=${month}&year=${year}${filterCat ? `&category_id=${filterCat}` : ''}`),
      api.get('/categories'),
    ]);
    setExpenses(exRes.data);
    setCategories(catRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [month, year, filterCat]);

  const deleteExpense = async id => {
    if (!confirm('למחוק הוצאה זו?')) return;
    await api.delete(`/expenses/${id}`);
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const handleSaved = async (updatedId) => {
    setShowAdd(false);
    if (updatedId) {
      // עדכון פריט ספציפי בלי לטעון הכל מחדש
      const { data } = await api.get(`/expenses?month=${month}&year=${year}`);
      setExpenses(data);
    } else {
      // הוצאה חדשה — טען מחדש
      load();
    }
    setEditItem(null);
  };

  const filtered = expenses.filter(e =>
    !search || e.description?.includes(search) || e.merchant?.includes(search) ||
    String(e.amount).includes(search)
  );

  const grouped = filtered.reduce((acc, e) => {
    const d = e.expense_date?.split('T')[0] || e.expense_date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(e);
    return acc;
  }, {});

  return (
    <div className="page">
      <div className="page-header">
        <h2>הוצאות</h2>
        <button className="btn-fab" onClick={() => setShowAdd(true)}>+ הוסף</button>
      </div>

      <div className="filters-row">
        <div className="search-box">
          <Search size={16} />
          <input placeholder="חיפוש..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={month} onChange={e => setMonth(+e.target.value)}>
          {MONTHS_HE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(+e.target.value)}>
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">כל הקטגוריות</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading">טוען...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧾</div>
          <p>אין הוצאות לתקופה זו</p>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>הוסף הוצאה ראשונה</button>
        </div>
      ) : (
        Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => (
          <div key={date} className="expense-group">
            <div className="expense-date-header">{formatDate(date)}</div>
            {items.map(e => (
              <div key={e.id} className="expense-item">
                <div className="expense-icon" style={{ background: e.category_color + '22', color: e.category_color }}>
                  {e.category_icon || '💰'}
                </div>
                <div className="expense-details">
                  <div className="expense-merchant">{e.merchant || e.description || 'הוצאה'}</div>
                  <div className="expense-meta">{e.category_name || 'ללא קטגוריה'}{e.notes ? ` · ${e.notes}` : ''}</div>
                </div>
                <div className="expense-right">
                  <div className="expense-amount">₪{parseFloat(e.amount).toLocaleString('he-IL', { minimumFractionDigits: 2 })}</div>
                  <div className="expense-actions">
                    {e.receipt_url && <a href={`${import.meta.env.VITE_API_URL?.replace('/api','')||'http://localhost:3001'}${e.receipt_url}`} target="_blank" rel="noreferrer" className="icon-btn">🧾</a>}
                    <button className="icon-btn" onClick={() => setEditItem(e)}><Edit2 size={14}/></button>
                    <button className="icon-btn danger" onClick={() => deleteExpense(e.id)}><Trash2 size={14}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {(showAdd || editItem) && (
        <AddExpenseModal
          categories={categories}
          editItem={editItem}
          onClose={() => { setShowAdd(false); setEditItem(null); }}
          onSaved={(id) => handleSaved(id)}
        />
      )}
    </div>
  );
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'היום';
  if (d.toDateString() === yesterday.toDateString()) return 'אתמול';
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}
