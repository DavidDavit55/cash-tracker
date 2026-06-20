import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader } from 'lucide-react';
import api from '../api/client';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

export default function AddExpenseModal({ categories, editItem, onClose, onSaved }) {
  const isEdit = !!editItem;
  const [form, setForm] = useState({
    amount: editItem?.amount || '',
    description: editItem?.description || '',
    merchant: editItem?.merchant || '',
    category_id: editItem?.category_id || '',
    expense_date: editItem?.expense_date?.split('T')[0] || new Date().toISOString().split('T')[0],
    notes: editItem?.notes || '',
  });
  const [receipt, setReceipt] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();
  const cameraRef = useRef();

  const handleFile = file => {
    if (!file) return;
    setReceipt(file);
    setPreview(URL.createObjectURL(file));
  };

  const submit = async e => {
    e.preventDefault();
    if (!form.amount) { setError('יש להזין סכום'); return; }
    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        await api.put(`/expenses/${editItem.id}`, form);
        if (receipt) {
          const fd = new FormData();
          Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
          fd.append('receipt', receipt);
          await api.put(`/expenses/${editItem.id}/receipt`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
        onSaved(editItem.id); // העבר ID כדי לעדכן בלי reload
      } else {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
        if (receipt) fd.append('receipt', receipt);
        await api.post('/expenses', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        onSaved(null); // null = הוצאה חדשה, טען מחדש
      }
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בשמירה');
    } finally {
      setLoading(false);
    }
  };

  const scanReceipt = async () => {
    if (!receipt) return;
    setOcrLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('receipt', receipt);
      const res = await api.post('/expenses/scan', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data.amount) setForm(p => ({ ...p, amount: res.data.amount }));
      if (res.data.merchant) setForm(p => ({ ...p, merchant: res.data.merchant }));
      if (res.data.description) setForm(p => ({ ...p, description: res.data.description }));
      if (res.data.date) setForm(p => ({ ...p, expense_date: res.data.date }));
    } catch {
      setError('שגיאה בסריקת קבלה');
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{isEdit ? 'ערוך הוצאה' : 'הוצאה חדשה'}</h3>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* אזור קבלה — מוצג תמיד */}
        <div className="receipt-upload">
          {preview ? (
            <div className="receipt-preview">
              <img src={preview} alt="קבלה" />
              <button className="btn-sm" onClick={() => { setReceipt(null); setPreview(null); }}>הסר</button>
            </div>
          ) : editItem?.receipt_url ? (
            <div className="receipt-preview">
              <img src={`${API_BASE}${editItem.receipt_url}`} alt="קבלה קיימת" />
              <button className="btn-sm" onClick={() => fileRef.current.click()}>החלף קבלה</button>
            </div>
          ) : (
            <div className="receipt-buttons">
              <button type="button" className="receipt-btn" onClick={() => cameraRef.current.click()}>
                <Camera size={24} />
                <span>צלם קבלה</span>
              </button>
              <button type="button" className="receipt-btn" onClick={() => fileRef.current.click()}>
                <Upload size={24} />
                <span>העלה תמונה</span>
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => handleFile(e.target.files[0])} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={e => handleFile(e.target.files[0])} />
          {receipt && !ocrLoading && !isEdit && (
            <button type="button" className="btn-secondary" style={{ marginTop: '8px' }} onClick={scanReceipt}>
              ✨ סרוק קבלה עם AI
            </button>
          )}
          {ocrLoading && <div className="ocr-loading"><Loader size={16} className="spin" /> מנתח קבלה...</div>}
        </div>

        <form onSubmit={submit}>
          <div className="form-row">
            <div className="form-group">
              <label>סכום (₪) *</label>
              <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>תאריך</label>
              <input type="date" value={form.expense_date} onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>שם העסק</label>
            <input value={form.merchant} onChange={e => setForm(p => ({ ...p, merchant: e.target.value }))} placeholder="סופרמרקט, מסעדה..." />
          </div>
          <div className="form-group">
            <label>תיאור</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="מה קנית?" />
          </div>
          <div className="form-group">
            <label>קטגוריה</label>
            <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}>
              <option value="">בחר קטגוריה</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>הערות</label>
            <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="הערות נוספות..." />
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'שומר...' : isEdit ? 'עדכן' : 'שמור'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
