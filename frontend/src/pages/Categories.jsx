import { useState, useEffect } from 'react';
import { Trash2, Edit2, Plus } from 'lucide-react';
import api from '../api/client';

const COLORS = ['#22c55e','#f97316','#3b82f6','#a855f7','#ef4444','#eab308','#06b6d4','#6b7280','#ec4899','#14b8a6'];
const ICONS = ['🛒','🍽️','🚗','👕','💊','🎮','📚','📦','🏠','✈️','🎁','💇','🐾','🔧','🎵'];

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', icon: '📦', color: '#6b7280' });

  const load = () => api.get('/categories').then(r => setCategories(r.data));
  useEffect(() => { load(); }, []);

  const openEdit = cat => {
    setEditItem(cat);
    setForm({ name: cat.name, icon: cat.icon, color: cat.color });
    setShowForm(true);
  };

  const save = async e => {
    e.preventDefault();
    if (editItem) {
      await api.put(`/categories/${editItem.id}`, form);
    } else {
      await api.post('/categories', form);
    }
    setShowForm(false);
    setEditItem(null);
    setForm({ name: '', icon: '📦', color: '#6b7280' });
    load();
  };

  const remove = async id => {
    if (!confirm('למחוק קטגוריה זו? כל ההוצאות בה לא יימחקו.')) return;
    await api.delete(`/categories/${id}`);
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>קטגוריות</h2>
        <button className="btn-fab" onClick={() => { setEditItem(null); setForm({ name: '', icon: '📦', color: '#6b7280' }); setShowForm(true); }}>+ הוסף</button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <h3>{editItem ? 'ערוך קטגוריה' : 'קטגוריה חדשה'}</h3>
            <form onSubmit={save}>
              <div className="form-group">
                <label>שם</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="שם הקטגוריה" />
              </div>
              <div className="form-group">
                <label>אייקון</label>
                <div className="icon-grid">
                  {ICONS.map(ic => (
                    <button key={ic} type="button" className={`icon-option ${form.icon === ic ? 'selected' : ''}`} onClick={() => setForm(p => ({ ...p, icon: ic }))}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>צבע</label>
                <div className="color-grid">
                  {COLORS.map(c => (
                    <button key={c} type="button" className={`color-option ${form.color === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => setForm(p => ({ ...p, color: c }))} />
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>ביטול</button>
                <button type="submit" className="btn-primary">שמור</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        {categories.map(cat => (
          <div key={cat.id} className="category-item">
            <div className="cat-badge" style={{ background: cat.color + '22', color: cat.color }}>{cat.icon}</div>
            <span className="cat-name">{cat.name}</span>
            {cat.is_default && <span className="badge-default">ברירת מחדל</span>}
            <div className="cat-actions">
              <button className="icon-btn" onClick={() => openEdit(cat)}><Edit2 size={14}/></button>
              <button className="icon-btn danger" onClick={() => remove(cat.id)}><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
