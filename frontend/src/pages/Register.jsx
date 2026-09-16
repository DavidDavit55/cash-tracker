import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

const QUESTIONS = [
  { key: 'risk_tolerance', label: 'מה סיבולת הסיכון שלך?', options: ['שמרן', 'מאוזן', 'נועז'] },
  { key: 'investment_horizon', label: 'מה אופק ההשקעה שלך?', options: ['קצר (עד 3 שנים)', 'בינוני (3-10 שנים)', 'ארוך (10+ שנים)'] },
  { key: 'financial_knowledge', label: 'מה רמת הידע הפיננסי שלך?', options: ['מתחיל', 'בינוני', 'מתקדם'] },
  { key: 'goals', label: 'מה המטרה הפיננסית העיקרית שלך?', options: ['חיסכון לפרישה', 'רכישת דירה', 'גידול הון', 'ביטחון כלכלי'] },
  { key: 'life_stage', label: 'מה שלב החיים שלך?', options: ['רווק/ה', 'זוג ללא ילדים', 'משפחה עם ילדים', 'לקראת פרישה'] },
];

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [account, setAccount] = useState({ name: '', email: '', password: '', phone: '' });
  const [idInfo, setIdInfo] = useState({ id_number: '', birth_date: '', id_issue_date: '' });
  const [answers, setAnswers] = useState({});

  const submitAccount = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(account.name, account.email, account.password);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בהרשמה');
    } finally {
      setLoading(false);
    }
  };

  const submitIdInfo = e => {
    e.preventDefault();
    setStep(3);
  };

  const submitQuestionnaire = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/client-profile', {
        phone: account.phone,
        id_number: idInfo.id_number,
        birth_date: idInfo.birth_date,
        id_issue_date: idInfo.id_issue_date,
        ...answers,
      });
      nav('/');
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בשמירת הפרופיל');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">💵</div>
        <h1>NETWORTH</h1>
        <p className="auth-subtitle">שלב {step} מתוך 3</p>

        {step === 1 && (
          <form onSubmit={submitAccount}>
            <div className="form-group">
              <label>שם מלא</label>
              <input value={account.name} onChange={e => setAccount(p => ({ ...p, name: e.target.value }))} required placeholder="ישראל ישראלי" />
            </div>
            <div className="form-group">
              <label>טלפון</label>
              <input value={account.phone} onChange={e => setAccount(p => ({ ...p, phone: e.target.value }))} required placeholder="050-1234567" />
            </div>
            <div className="form-group">
              <label>אימייל</label>
              <input type="email" value={account.email} onChange={e => setAccount(p => ({ ...p, email: e.target.value }))} required placeholder="your@email.com" />
            </div>
            <div className="form-group">
              <label>סיסמה</label>
              <input type="password" value={account.password} onChange={e => setAccount(p => ({ ...p, password: e.target.value }))} required placeholder="לפחות 6 תווים" minLength={6} />
            </div>
            {error && <div className="form-error">{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'יוצר חשבון...' : 'המשך'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submitIdInfo}>
            <div className="form-group">
              <label>תעודת זהות</label>
              <input value={idInfo.id_number} onChange={e => setIdInfo(p => ({ ...p, id_number: e.target.value }))} required placeholder="123456789" />
            </div>
            <div className="form-group">
              <label>תאריך לידה</label>
              <input type="date" value={idInfo.birth_date} onChange={e => setIdInfo(p => ({ ...p, birth_date: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>תאריך הנפקת תעודת הזהות</label>
              <input type="date" value={idInfo.id_issue_date} onChange={e => setIdInfo(p => ({ ...p, id_issue_date: e.target.value }))} required />
            </div>
            <button type="submit" className="btn-primary">המשך</button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={submitQuestionnaire}>
            {QUESTIONS.map(q => (
              <div className="form-group" key={q.key}>
                <label>{q.label}</label>
                <select
                  value={answers[q.key] || ''}
                  onChange={e => setAnswers(p => ({ ...p, [q.key]: e.target.value }))}
                  required
                >
                  <option value="" disabled>בחר...</option>
                  {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            {error && <div className="form-error">{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'שומר...' : 'סיום והמשך לאזור האישי'}
            </button>
          </form>
        )}

        {step === 1 && <p className="auth-link">יש לך חשבון? <Link to="/login">התחבר</Link></p>}
      </div>
    </div>
  );
}
