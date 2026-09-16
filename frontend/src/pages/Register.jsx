import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { isValidIsraeliId } from '../lib/israeliId';
import SignaturePad from '../components/SignaturePad';

const QUESTIONS = [
  { key: 'risk_tolerance', label: 'מה סיבולת הסיכון שלך?', options: ['שמרן', 'מאוזן', 'נועז'] },
  { key: 'investment_horizon', label: 'מה אופק ההשקעה שלך?', options: ['קצר (עד 3 שנים)', 'בינוני (3-10 שנים)', 'ארוך (10+ שנים)'] },
  { key: 'financial_knowledge', label: 'מה רמת הידע הפיננסי שלך?', options: ['מתחיל', 'בינוני', 'מתקדם'] },
  { key: 'goals', label: 'מה המטרה הפיננסית העיקרית שלך?', options: ['חיסכון לפרישה', 'רכישת דירה', 'גידול הון', 'ביטחון כלכלי'] },
  { key: 'life_stage', label: 'מה שלב החיים שלך?', options: ['רווק/ה', 'זוג ללא ילדים', 'משפחה עם ילדים', 'לקראת פרישה'] },
];

const MARITAL_OPTIONS = ['רווק/ה', 'נשוי/אה', 'גרוש/ה', 'אלמן/ה'];
const INCOME_OPTIONS = ['עד 8,000 ₪', '8,000-15,000 ₪', 'מעל 15,000 ₪'];

const AGENT_NAME = 'דוד דויטשוילי';
const AGENT_LICENSE = 'L-00138948';

// טקסט משפטי מלא ומדויק (לא ניסוח חופשי) - מבוסס על נספחים א', ב', ה' הרשמיים של רשות שוק ההון.
// {name}/{id} מוחלפים בפרטי הנרשם בפועל בזמן ההצגה.
function buildConsentText(key, name, id) {
  if (key === 'maslaka') {
    return `אני, ${name}, ת.ז ${id}, מייפה את כוחו של הסוכן ${AGENT_NAME} (רישיון מס' ${AGENT_LICENSE}), או מי מטעמו, לפנות בשמי לכל גוף מוסדי (חברת ביטוח, קופת גמל, קרן השתלמות או קרן פנסיה) לשם קבלת מידע אודות מוצרים פנסיוניים ותכניות ביטוח שברשותי, לצורך מתן ייעוץ פנסיוני או שיווק פנסיוני. המידע כולל בין היתר: פרטי הגוף המנהל, סוג המוצר, פרטי החשבון, מסלולי השקעה, דמי ניהול, שיעור תשואה, הפקדות ויתרות, שעבודים ועיקולים. העברת המידע יכולה להיעשות באמצעות מערכת סליקה פנסיונית מרכזית. הרשאה זו תעמוד בתוקפה 3 חודשים מיום החתימה.`;
  }
  if (key === 'insurance_poa') {
    return `אני, ${name}, ת.ז ${id}, מייפה את כוחו של חברת הביטוח/סוכן הביטוח ${AGENT_NAME} (רישיון ${AGENT_LICENSE}) לדרוש ולקבל עבורי, עבור כל הפוליסות שלי, כל מידע הנדרש לו לצורך הליך התאמת ביטוח, לרבות קבלת דף פרטי הביטוח, קבלת העתק מטופס גילוי נאות של הפוליסה המקורית ודוח שנתי אחרון שנשלח אלי. ייפוי כוח זה יהיה בתוקף 30 ימי עבודה מיום חתימתו.`;
  }
  return `אני, ${name}, ת.ז ${id}, מייפה את כוחו של חברת הביטוח/סוכן הביטוח ${AGENT_NAME} לבצע חיפוש על שמי (ועל שם ילדיי הקטינים, ככל שרלוונטי) באתר "הר הביטוח" של רשות שוק ההון, ביטוח וחיסכון (harb.cma.gov.il), לאיתור מוצרי ביטוח על שמי. טופס הרשאה זה יעמוד בתוקף חמישה ימי עבודה מיום החתימה.`;
}

const CONSENT_ITEMS = [
  { key: 'maslaka', field: 'consent_maslaka', title: "הרשאה חד פעמית לקבלת מידע מהמסלקה הפנסיונית (נספח א')" },
  { key: 'insurance_poa', field: 'consent_insurance_poa', title: "ייפוי כוח לקבלת מידע מחברות ביטוח (נספח ב')" },
  { key: 'har_bituach', field: 'consent_har_bituach', title: "הרשאה לשימוש באתר הר הביטוח (נספח ה')" },
];

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [account, setAccount] = useState({ name: '', email: '', password: '', phone: '' });
  const [idInfo, setIdInfo] = useState({ id_number: '', birth_date: '', id_issue_date: '', marital_status: '', monthly_income: '' });
  const [answers, setAnswers] = useState({});
  const [consents, setConsents] = useState({ consent_maslaka: false, consent_insurance_poa: false, consent_har_bituach: false });
  const [signature, setSignature] = useState(null);

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
    if (!isValidIsraeliId(idInfo.id_number)) {
      setError('תעודת זהות לא תקינה');
      return;
    }
    setError('');
    setStep(3);
  };

  const submitQuestionnaire = e => {
    e.preventDefault();
    setError('');
    setStep(4);
  };

  const submitConsents = async e => {
    e.preventDefault();
    if (!consents.consent_maslaka || !consents.consent_insurance_poa || !consents.consent_har_bituach) {
      setError('יש לאשר את כל ההרשאות');
      return;
    }
    if (!signature) {
      setError('יש לחתום לפני השליחה');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/client-profile', {
        phone: account.phone,
        id_number: idInfo.id_number,
        birth_date: idInfo.birth_date,
        id_issue_date: idInfo.id_issue_date,
        marital_status: idInfo.marital_status,
        monthly_income: idInfo.monthly_income,
        ...answers,
        ...consents,
        signature_data: signature,
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
        <img src="/logo.png" alt="לוגו" style={{ height: '48px', objectFit: 'contain', marginBottom: '8px' }} />
        <h1>NETWORTH</h1>
        <p className="auth-subtitle">שלב {step} מתוך 4</p>

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
            <div className="form-group">
              <label>מצב משפחתי</label>
              <select value={idInfo.marital_status} onChange={e => setIdInfo(p => ({ ...p, marital_status: e.target.value }))} required>
                <option value="" disabled>בחר...</option>
                {MARITAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>הכנסה חודשית</label>
              <select value={idInfo.monthly_income} onChange={e => setIdInfo(p => ({ ...p, monthly_income: e.target.value }))} required>
                <option value="" disabled>בחר...</option>
                {INCOME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {error && <div className="form-error">{error}</div>}
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
            <button type="submit" className="btn-primary">המשך</button>
          </form>
        )}

        {step === 4 && (
          <form onSubmit={submitConsents}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              כדי שדוד יוכל למשוך עבורך את נתוני הפנסיה, הגמל והביטוח שלך, צריך לאשר את שלוש ההרשאות הבאות ולחתום בסוף.
            </p>
            {CONSENT_ITEMS.map(item => (
              <div key={item.key} style={{ background: 'var(--bg)', borderRadius: '10px', padding: '10px 12px', marginBottom: '10px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>{item.title}</div>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {buildConsentText(item.key, account.name, idInfo.id_number)}
                </p>
              </div>
            ))}

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', margin: '4px 0 14px' }}>
              <input
                type="checkbox"
                checked={consents.consent_maslaka && consents.consent_insurance_poa && consents.consent_har_bituach}
                onChange={e => setConsents({
                  consent_maslaka: e.target.checked,
                  consent_insurance_poa: e.target.checked,
                  consent_har_bituach: e.target.checked,
                })}
              />
              קראתי ואני מאשר/ת את שלוש ההרשאות למעלה
            </label>

            <div className="form-group">
              <label>חתימה</label>
              <SignaturePad onChange={setSignature} />
            </div>

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
