import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      nav('/');
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בהרשמה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">💵</div>
        <h1>מעקב מזומן</h1>
        <p className="auth-subtitle">צור חשבון חדש</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>שם מלא</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="ישראל ישראלי" />
          </div>
          <div className="form-group">
            <label>אימייל</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required placeholder="your@email.com" />
          </div>
          <div className="form-group">
            <label>סיסמה</label>
            <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required placeholder="לפחות 6 תווים" minLength={6} />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'יוצר חשבון...' : 'הרשמה'}
          </button>
        </form>
        <p className="auth-link">יש לך חשבון? <Link to="/login">התחבר</Link></p>
      </div>
    </div>
  );
}
