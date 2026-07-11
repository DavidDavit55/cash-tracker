import { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp, Receipt } from 'lucide-react';
import api from '../api/client';

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const SOURCES = ['עמלות ביטוח', 'משלוחים', 'משכורת', 'פרילנס', 'אחר'];
const PAYMENT_METHODS = ['העברה בנקאית', 'מזומן', "צ'ק"];
const VAT = 1.18;

function fmt(n) { return parseFloat(n || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 }); }
function fmt2(n) { return parseFloat(n || 0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

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
    load();
  };

  const total = parseFloat(stats?.total?.total || 0);
  const vat = stats?.vat;
  const periodVat = parseFloat(vat?.period_vat || 0);

  return (
    <div className="page">
      <div className="page-header">
        <h2>הכנסות</h2>
        <div className="month-selector">
          <select value={month} onChange={e => setMonth(+e.target.value)}>
            {MONTHS_HE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* סה"כ הכנסות */}
      <div className="summary-card" style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
        <div className="summary-amount">₪{fmt2(total)}</div>
        <div className="summary-label">סה"כ הכנסות — {MONTHS_HE[month - 1]} {year}</div>
        {vat?.month_gross > 0 && (
          <div style={{ marginTop: '6px', fontSize: '0.8rem', opacity: 0.9 }}>
            מזה עמלות ביטוח (ברוטו) ₪{fmt(vat.month_gross)} · נטו ₪{fmt(vat.month_net)}
          </div>
        )}
        <div className="summary-count">{stats?.total?.count || 0} פעולות</div>
      </div>

      {/* כרטיס חוב מע"מ דו-חודשי */}
      {periodVat > 0 && (
        <div className="summary-card" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={20} color="white" />
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'white' }}>חוב מע"מ — {vat.period_label}</span>
          </div>
          <div className="summary-amount" style={{ fontSize: '1.6rem', marginTop: '6px' }}>₪{fmt(periodVat)}</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '4px' }}>
            על עמלות ביטוח (₪{fmt(vat.period_gross)} ברוטו)
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '2px' }}>
            18% מע"מ · נטו ₪{fmt(vat.period_net)}
          </div>
        </div>
      )}

      {/* פילוח לפי מקור */}
      {stats?.bySource?.length > 0 && (
        <div className="chart-card">
          <h3>לפי מקור</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
            {stats.bySource.map((s, i) => {
              const gross = parseFloat(s.total);
              const pct = total > 0 ? (gross / total) * 100 : 0;
              const net = s.has_vat ? gross / VAT : null;
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.82rem' }}>
                    <span style={{ fontWeight: 500 }}>
                      {s.source || 'אחר'} · {s.payment_method}
                      {s.has_vat && <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#92400e', borderRadius: '4px', padding: '1px 5px', marginRight: '5px' }}>כולל מע"מ</span>}
                    </span>
                    <span style={{ fontWeight: 700, color: '#22c55e' }}>
                      ₪{fmt(gross)}
                      {net && <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.75rem' }}> (נטו ₪{fmt(net)})</span>}
                    </span>
                  </div>
                  <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: s.has_vat ? '#f59e0b' : '#22c55e', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* רשימת הכנסות */}
      <div className="card">
        {incomes.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>אין הכנסות לחודש זה</div>
        ) : incomes.map(inc => {
          const gross = parseFloat(inc.amount);
          const net = inc.includes_vat ? gross / VAT : null;
          const vatAmt = inc.includes_vat ? gross - net : null;
          return (
            <div key={inc.id} className="expense-row">
              <div className="expense-icon" style={{ background: inc.includes_vat ? '#fef3c7' : '#dcfce7' }}>
                <TrendingUp size={18} color={inc.includes_vat ? '#d97706' : '#22c55e'} />
              </div>
              <div className="expense-info">
                <div className="expense-merchant">
                  {inc.source || 'הכנסה'}
                  {inc.includes_vat && (
                    <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#92400e', borderRadius: '4px', padding: '1px 5px', marginRight: '5px' }}>כולל מע"מ</span>
                  )}
                </div>
                <div className="expense-date">
                  {inc.description || inc.payment_method} · {new Date(inc.income_date).toLocaleDateString('he-IL')}
                </div>
                {inc.includes_vat && net && (
                  <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>
                    נטו ₪{fmt(net)} · מע"מ 18% ₪{fmt(vatAmt)}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="expense-amount" style={{ color: '#22c55e' }}>+₪{fmt(gross)}</span>
                <button className="icon-btn" onClick={() => handleDelete(inc.id)}><Trash2 size={16} color="#ef4444" /></button>
              </div>
            </div>
          );
        })}
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
    includes_vat: editItem?.includes_vat ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const gross = parseFloat(form.amount) || 0;
  const net = form.includes_vat && gross > 0 ? gross / VAT : null;
  const vatPreview = net ? gross - net : null;

  const handleSourceChange = (source) => {
    setForm(p => ({ ...p, source, includes_vat: source === 'עמלות ביטוח' }));
  };

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
              <label>סכום ברוטו (₪) *</label>
              <input type="number" step="0.01" min="0" value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>תאריך</label>
              <input type="date" value={form.income_date}
                onChange={e => setForm(p => ({ ...p, income_date: e.target.value }))} />
            </div>
          </div>

          {/* תצוגה מקדימה של פירוק מע"מ */}
          {form.includes_vat && net && (
            <div style={{ background: '#fef3c7', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>נטו (÷1.17)</span>
                <strong>₪{fmt2(net)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#92400e', marginTop: '4px' }}>
                <span>מע"מ לשלם (18%)</span>
                <strong>₪{fmt2(vatPreview)}</strong>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>מקור</label>
            <select value={form.source} onChange={e => handleSourceChange(e.target.value)}>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              id="includes_vat"
              checked={!!form.includes_vat}
              onChange={e => setForm(p => ({ ...p, includes_vat: e.target.checked }))}
              style={{ width: '18px', height: '18px', accentColor: '#f59e0b', cursor: 'pointer' }}
            />
            <label htmlFor="includes_vat" style={{ cursor: 'pointer', marginBottom: 0 }}>
              הסכום כולל מע"מ (17%) — יחושב חוב רבעוני
            </label>
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
