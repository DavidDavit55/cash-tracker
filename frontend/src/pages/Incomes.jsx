import { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import api from '../api/client';

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

const SOURCES = ['עמלות ביטוח', 'משלוחים', 'משכורת', 'פרילנס', 'אחר'];
const PAYMENT_METHODS = ['העברה בנקאית', 'מזומן', 'צ\'ק'];

export default function Incomes() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [incomes, setIncomes] = useState([]);
  const [stats, setStats] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const load = () => {
    api.get(`/incomes?month=${month}&year=${year}`).then(r => setIncomes(r.data));
    api.get(`/incomes/stats/summary?month=${month}&year=${year}`).then(r => setStats(r.data));
  };

  useEffect(() => { load(); }, [month, year]);

  const handleDelete = async (id) => {
    if (!window.confirm('למחוק הכנסה זו?')) return;
    await api.delete(`/incomes/${id}`);
    setIncomes(prev => prev.filter(i => i.id !== id));
    load();
  };

  const total = parseFloat(stats?.total?.total || 0);

  return (
    <div className="page">
      <div className="page-header">
        <h2>הכנסות 💰</h2>
        <div className="month-selector">
          <select value={month} onChange={e => setMonth(+e.target.value)}>
            {MONTHS_HE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="summary-card" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
        <div className="summary-amount">₪{total.toLocaleString('he-IL', { minimumFractionDigits: 2 })}</div>
        <div className="summary-label">סה"כ הכנסות — {MONTHS_HE[month - 1]} {year}</div>
        <div className="summary-count">{stats?.total?.count || 0} פעולות</div>
      </div>

      {stats?.bySource?.length > 0 && (
        <div className="chart-card">
          <h3>לפי מקור</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
            {stats.bySource.map((s, i) => {
              const pct = total > 0 ? (parseFloat(s.total) / total) * 100 : 0;
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.82rem' }}>
                    <span style={{ fontWeight: 500 }}>{s.source || 'אחר'} · {s.payment_method}</span>
                    <span style={{ fontWeight: 700, color: '#22c55e' }}>₪{parseFloat(s.total).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#22c55e', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        {incomes.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>אין הכנסות לחודש זה</div>
        ) : (
          incomes.map(inc => (
            <div key={inc.id} className="expense-row">
              <div className="expense-icon" style={{ background: '#dcfce7' }}>
                <TrendingUp size={18} color="#22c55e" />
              </div>
              <div className="expense-info">
                <div className="expense-merchant">{inc.source || 'הכנסה'}</div>
                <div className="expense-date">{inc.description || inc.payment_method} · {new Date(inc.income_date).toLocaleDateString('he-IL')}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="expense-amount" style={{ color: '#22c55e' }}>+₪{parseFloat(inc.amount).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</span>
                <button className="icon-btn" onClick={() => handleDelete(inc.id)}><Trash2 size={16} color="#ef4444" /></button>
              </div>
            </div>
          ))
        )}
      </div>

      <button className="fab" onClick={() => { setEditItem(null); setShowModal(true); }}>
        <Plus size={24} />
      </button>

      {showModal && (
        <IncomeModal
          editItem={editItem}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function IncomeModal({ editItem, onClose, onSaved }) {
  const [form, setForm] = useState({
    amount: editItem?.amount || '',
    source: editItem?.source || 'עמלות ביטוח',
    description: editItem?.description || '',
    income_date: editItem?.income_date?.split('T')[0] || new Date().toISOString().split('T')[0],
    payment_method: editItem?.payment_method || 'העברה בנקאית',
    notes: editItem?.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async e => {
    e.preventDefault();
    if (!form.amount) { setError('יש להזין סכום'); return; }
    setLoading(true);
    try {
      if (editItem) {
        await api.put(`/incomes/${editItem.id}`, form);
      } else {
        await api.post('/incomes', form);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בשמירה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{editItem ? 'ערוך הכנסה' : 'הכנסה חדשה'}</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="form-group">
              <label>סכום (₪) *</label>
              <input type="number" step="0.01" min="0" value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>תאריך</label>
              <input type="date" value={form.income_date}
                onChange={e => setForm(p => ({ ...p, income_date: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>מקור</label>
            <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>אמצעי תשלום</label>
            <select value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>תיאור</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="חברת ביטוח, לקוח..." />
          </div>
          <div className="form-group">
            <label>הערות</label>
            <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="הערות נוספות..." />
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'שומר...' : 'שמור'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
