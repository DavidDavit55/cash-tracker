import { digitsOnly, phoneDigits } from '../lib/numericInput';
import BrandLogo from '../sandbox/BrandLogo';
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
        <div className="auth-brand"><BrandLogo /></div>
        <h1>האזור האישי שלך</h1>
        <p className="auth-subtitle">התחבר לחשבון שלך</p>

        {stage === 'phone' && (
          <form onSubmit={sendCode}>
            <div className="form-group">
              <label>טלפון</label>
              <input type="text" inputMode="numeric" pattern="0[0-9]{9}" autoComplete="tel-national" dir="ltr" value={phone} onChange={e => setPhone(phoneDigits(e.target.value))} required placeholder="050-1234567" />
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
              <input type="text" pattern="[0-9]{6}" autoComplete="one-time-code" dir="ltr" value={code} onChange={e => setCode(digitsOnly(e.target.value, 6))} required placeholder="123456" inputMode="numeric" />
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
