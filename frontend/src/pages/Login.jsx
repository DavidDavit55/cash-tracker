import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const { loginSendCode, loginCheckCode } = useAuth();
  const nav = useNavigate();
  const [stage, setStage] = useState('phone'); // phone | code
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sendCode = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginSendCode(phone);
      setStage('code');
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בשליחת הקוד');
    } finally {
      setLoading(false);
    }
  };

  const checkCode = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginCheckCode(phone, code);
      nav('/');
    } catch (err) {
      setError(err.response?.data?.error || 'קוד שגוי');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img src="/logo.png" alt="לוגו" style={{ height: '48px', objectFit: 'contain', marginBottom: '8px' }} />
        <h1>NETWORTH</h1>
        <p className="auth-subtitle">התחבר לחשבון שלך</p>

        {stage === 'phone' && (
          <form onSubmit={sendCode}>
            <div className="form-group">
              <label>טלפון</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="050-1234567" />
            </div>
            {error && <div className="form-error">{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'שולח...' : 'שלח קוד'}
            </button>
          </form>
        )}

        {stage === 'code' && (
          <form onSubmit={checkCode}>
            <div className="form-group">
              <label>קוד אימות נשלח ב-SMS ל-{phone}</label>
              <input value={code} onChange={e => setCode(e.target.value)} required placeholder="123456" inputMode="numeric" />
            </div>
            {error && <div className="form-error">{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'מתחבר...' : 'התחבר'}
            </button>
          </form>
        )}

        <p className="auth-link">אין חשבון? <Link to="/register">הרשם</Link></p>
      </div>
    </div>
  );
}
