import { useState, useEffect } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api/client';

const FIELDS = [
  ['id_number', 'תעודת זהות'],
  ['birth_date', 'תאריך לידה'],
  ['id_issue_date', 'תאריך הנפקת ת.ז'],
  ['risk_tolerance', 'סיבולת סיכון'],
  ['investment_horizon', 'אופק השקעה'],
  ['financial_knowledge', 'ידע פיננסי'],
  ['goals', 'מטרה פיננסית'],
  ['life_stage', 'שלב חיים'],
];

const STATUS_OPTIONS = ['ממתין למשיכת מסלקה', 'נוצר קשר', 'הושלם'];

export default function AdminClientDetail() {
  const { user } = useAuth();
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/admin/clients/${id}`)
      .then(({ data }) => setClient(data))
      .catch(err => setError(err.response?.data?.error || 'שגיאה בטעינת הלקוח'));
  }, [id]);

  if (user && import.meta.env.VITE_ADMIN_EMAIL && user.email !== import.meta.env.VITE_ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  const updateStatus = (status) => {
    setSaving(true);
    api.patch(`/admin/clients/${id}/status`, { status })
      .then(({ data }) => setClient(c => ({ ...c, status: data.status })))
      .catch(err => setError(err.response?.data?.error || 'שגיאה בעדכון'))
      .finally(() => setSaving(false));
  };

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/admin/clients">← חזרה ללקוחות</Link>
        <h2>{client?.name || 'לקוח'}</h2>
      </div>

      {error && <div className="form-error">{error}</div>}
      {!client && !error && <div className="loading">טוען...</div>}

      {client && (
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {client.email} · {client.phone || 'אין טלפון'}
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>סטטוס</label>
            <select
              value={client.status || ''}
              disabled={saving}
              onChange={(e) => updateStatus(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', borderRadius: '8px' }}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {FIELDS.map(([key, label]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #e2e8f0', fontSize: '0.88rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
              <span>{client[key] || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
