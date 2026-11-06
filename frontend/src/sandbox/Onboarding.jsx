import { ArrowLeft, ArrowRight, Check, Wallet, ShieldCheck, Landmark, Sparkles, X } from 'lucide-react';
import { money, portfolio } from './model';
import './onboarding.css';

const steps = ['מתחילים', 'מה חשוב לך', 'מחברים נתונים', 'התמונה שלך'];
const goals = [
  ['savings', 'להכיר את החסכונות שלי', 'פנסיה, גמל והשתלמות — במקום אחד', Wallet],
  ['insurance', 'לעשות סדר בביטוחים', 'להבין על מה משלמים ומה מכוסה', ShieldCheck],
  ['recommendations', 'לבדוק איפה אפשר לשפר', 'דמי ניהול והזדמנויות לבדיקה', Sparkles],
  ['cashflow', 'להבין לאן הכסף הולך', 'תזרים, הוצאות ותקציב', Landmark],
];
export default function Onboarding({ draft, onDraft, snapshot, children, onFinish, onClose, busy }) {
  const { step, selected } = draft;
  const data = portfolio(snapshot);
  const setStep = step => onDraft({ ...draft, step });
  const ready = snapshot.source !== 'empty';
  return <div className="sb-onboarding" dir="rtl"><header className="ob-header"><strong>NETWORTH<span /></strong><span>בוא נעשה סדר בכסף שלך</span><button onClick={onClose} aria-label="יציאה מתהליך ההיכרות"><X size={20} /></button></header>
    <aside className="ob-story"><span className="ob-eyebrow">פחות סימני שאלה. יותר תמונה מלאה.</span><h1>הכסף שלך.<br />סוף סוף ביחד.</h1><p>החסכונות, הביטוחים והיום־יום הפיננסי שלך, במקום שאפשר להבין.</p><div className="ob-orbit" aria-hidden="true"><div>NET<br /><b>WORTH</b></div><span><Wallet />חסכונות</span><span><ShieldCheck />ביטוחים</span><span><Landmark />עו״ש</span></div><div className="ob-trust"><ShieldCheck size={20} /><span>אתה בוחר מה לחבר ובאיזה קצב להתקדם.</span></div></aside>
    <main className={`ob-main ob-step-${step}`}><nav aria-label="התקדמות בתהליך ההיכרות">{steps.map((label, index) => <button key={label} disabled={index > step || busy} aria-current={index === step ? 'step' : undefined} onClick={() => setStep(index)}><span>{index < step ? <Check size={14} /> : index + 1}</span>{label}</button>)}</nav>
      <div className="ob-content" key={step}>
        {step === 0 && <><span className="ob-kicker">נעים להכיר</span><h2>כל התמונה, בקצב שלך.</h2><p className="ob-lead">נתחיל במה שחשוב לך, נחבר את הנתונים ונראה מה כבר יש לך — ומה שווה לבדוק.</p><div className="ob-benefits"><div><Wallet /><span><b>יודעים מה יש</b><small>החסכונות והביטוחים בתמונה אחת</small></span></div><div><Sparkles /><span><b>מבינים מה אפשר לשפר</b><small>פירוט ברור והזדמנויות לבדיקה</small></span></div><div><ShieldCheck /><span><b>נשארים בשליטה</b><small>אפשר לחזור, לדלג ולהמשיך אחר כך</small></span></div></div><button className="ob-primary" onClick={() => setStep(1)}>בוא נתחיל <ArrowLeft size={18} /></button><button className="ob-text" onClick={() => setStep(2)}>כבר יש לי תיק — לחיבור הנתונים</button></>}
        {step === 1 && <><span className="ob-kicker">מתחילים ממך</span><h2>מה היית רוצה להבין קודם?</h2><p className="ob-lead">אפשר לבחור כמה נושאים. הבחירה קובעת לאן נמשיך בסיום.</p><div className="ob-goals">{goals.map(([id, title, text, Icon]) => <button key={id} aria-pressed={selected.includes(id)} onClick={() => onDraft({ ...draft, selected: selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id] })}><Icon size={25} /><span><b>{title}</b><small>{text}</small></span><span className="ob-check">{selected.includes(id) && <Check size={16} />}</span></button>)}</div><button className="ob-primary" onClick={() => setStep(2)}>{selected.length ? 'ממשיכים לחיבור הנתונים' : 'נמשיך בלי לבחור כרגע'} <ArrowLeft size={18} /></button></>}
        {step === 2 && <><span className="ob-kicker">מחברים את החלקים</span><h2>איך נוח לך להתחיל?</h2><p className="ob-lead">התחבר לתיק קיים, בחר קובץ מסלקה או הר הביטוח, או הכר את המסכים עם תיק הדגמה.</p>{children}{ready && <button disabled={busy} className="ob-primary" onClick={() => setStep(3)}>{snapshot.source === 'demo' ? 'המשך עם תיק ההדגמה' : 'המשך עם התיק הטעון'} <ArrowLeft size={18} /></button>}</>}
        {step === 3 && <><span className="ob-success"><Check size={28} /></span><span className="ob-kicker">{snapshot.source === 'demo' ? 'מוכנים להכיר את המערכת' : 'הנתונים נקלטו'}</span><h2>יש לנו התחלה טובה.</h2><p className="ob-lead">{snapshot.source === 'demo' ? 'זהו תיק לדוגמה. המספרים כאן אינם הנתונים האישיים שלך.' : 'זו התמונה לפי המקורות שחיברת. אפשר להוסיף עוד נתונים בהמשך.'}</p><div className="ob-summary"><div><small>צבירה מדווחת</small><strong>{data.funds.length ? money(data.total) : 'טרם התקבלה'}</strong><span>{data.funds.length} מוצרי חיסכון</span></div><div><small>ביטוחים בתיק</small><strong>{data.policies.length}</strong><span>פוליסות שנקלטו</span></div></div><p className="ob-note">הצבירה אינה השווי הכולל שלך. יתרות בנק, נכסים והתחייבויות יוצגו כשיחוברו המקורות המתאימים.{data.unknownBalances > 0 && ` ${data.unknownBalances} מוצרים ללא יתרה לא נכללו בסכום.`}</p><button className="ob-primary" onClick={() => onFinish(selected[0] || 'home')}>לתמונה שלי <ArrowLeft size={18} /></button><button className="ob-text" onClick={() => setStep(2)}>לחבר מקור נוסף</button></>}
        {step > 0 && <button className="ob-back" disabled={busy} onClick={() => setStep(step - 1)}><ArrowRight size={16} />חזרה</button>}
      </div><footer>תצוגת ניסיון מקומית · אין יצירת חשבון או שמירת הרשאות בתהליך הזה</footer>
    </main></div>;
}
