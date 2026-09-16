import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import api from '../api/client';

export default function AdminClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/clients')
      .then(({ data }) => setClients(data))
      .catch(err => setError(err.response?.data?.error || 'שגיאה בטעינת הלקוחות'));
  }, []);

  if (user && import.meta.env.VITE_ADMIN_EMAIL && user.email !== import.meta.env.VITE_ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="page">
      <div className="page-header"><h2>לקוחות</h2></div>

      {error && <div className="form-error">{error}</div>}
      {!clients && !error && <div className="loading">טוען...</div>}

      {clients?.length === 0 && (
        <div className="empty-state">
          <p>אף אחד עדיין לא נרשם</p>
        </div>
      )}

      {clients?.length > 0 && (
        <div className="card">
          {clients.map(c => (
            <div key={c.id} className="budget-card">
              <div className="budget-header">
                <span className="budget-cat">{c.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.status}</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {c.email} · {c.phone || 'אין טלפון'} · נרשם ב-{new Date(c.created_at).toLocaleDateString('he-IL')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
