import React, { useEffect, useRef, useState } from 'react';
import { Home, ShieldPlus, Gift, UserRound, Sparkles, Menu, X, Info, ChevronLeft, ChevronDown, ArrowUpLeft, Send, Wallet, TrendingUp, Check, Copy } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import './style.css';

const money = n => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
const nav = [
  { id: 'home', title: 'מבט מהיר', icon: Home },
  { id: 'savings', title: 'החסכונות שלך', icon: Wallet },
  { id: 'insurance', title: 'הביטוחים שלך', icon: ShieldPlus },
  { id: 'recommendations', title: 'המלצות NETWORTH', icon: Sparkles, badge: 1 },
  { id: 'share', title: 'שתף חברים', icon: Gift },
  { id: 'profile', title: 'הפרופיל שלך', icon: UserRound },
];
const deposits = [260, 505, 458, 268, 718, 512, 250, 476, 425].map((value, i) => ({ month: ['11/25', '12/25', '1/26', '2/26', '3/26', '4/26', '5/26', '6/26', '7/26'][i], value }));
const returns = [19, 19.8, 21, 19.4, 20.2, 22, 23.5, 21.5, 27, 25, 19, 16].map((value, i) => ({ month: ['8.25', '9.25', '10.25', '11.25', '12.25', '1.26', '2.26', '3.26', '4.26', '5.26', '6.26', '7.26'][i], fund: value, average: value - 3 }));

function Ring({ title, onClick }) {
  return <section className="panel ring-panel">
    {title && <h2>{title}</h2>}
    <button className="ring-button" onClick={onClick} aria-label="הצגת פירוט החיסכון בסך 18,686 שקלים">
      <svg viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="101" fill="none" stroke="#2124ba" strokeWidth="14" /></svg>
      <span>{money(18686)}</span>
    </button>
    <div className="legend"><span><i />קרן פנסיה</span><span><i className="light-dot" />חיסכון לכל ילד</span></div>
    {title && <button className="text-link ring-link" onClick={onClick}>לכל החסכונות שלך <ChevronLeft size={15} /></button>}
  </section>;
}

function Comparison({ onSummary }) {
  const [salary, setSalary] = useState(false);
  const average = salary ? 21500 : 24000;
  return <section className="panel comparison">
    <h2>איך אני ביחס לאנשים דומים לי? <span title="נתוני השוואה להמחשה בלבד"><Info size={17} /></span></h2>
    <div className="compare-row"><div className="bar-track"><div className="compare-bar own" style={{ width: `${18686 / average * 100}%` }} /></div><div>אני<small>{money(18686)}</small></div></div>
    <div className="compare-row"><div className="bar-track"><div className="compare-bar" /></div><div>הממוצע<small>{money(average)}</small></div></div>
    <button className="switch-label" role="switch" aria-checked={salary} onClick={() => setSalary(!salary)}><span className={`switch ${salary ? 'on' : ''}`} />התחשב ברמת שכר <Info size={15} /></button>
    <div className="compare-footer"><button className="text-link" onClick={() => onSummary(salary)}>סיכום ההשוואה <Sparkles size={17} /></button></div>
  </section>;
}

function Product({ onOpen, child = false }) {
  return <article className="product panel">
    <div className="product-top"><strong>{child ? 'חיסכון לכל ילד — מסלול מוגבר' : 'קרן פנסיה מקיפה — מיטב'}</strong><span className="status">פעיל</span></div>
    <div className="product-body">
      <dl><div><dt>צבירה</dt><dd>{money(child ? 0 : 18686)}</dd></div><div><dt>דמי ניהול מהפקדה</dt><dd>{child ? '—' : '1%'}</dd></div><div><dt>דמי ניהול מצבירה</dt><dd>{child ? '—' : '0.22%'}</dd></div><div><dt>מסלול השקעה</dt><dd>{child ? 'סיכון מוגבר' : 'מיטב פנסיה מקיפה מניות'}</dd></div></dl>
      <div className="product-bottom"><span className="provider">{child ? 'אלטשולר שחם' : 'מיטב'}<span className="provider-mark">{child ? 'א' : 'מ'}</span></span><button className="primary small" onClick={onOpen}>לכל הפרטים <ChevronLeft size={14} /></button></div>
    </div>
  </article>;
}

function Recommendation({ onOpen }) {
  return <article className="panel recommendation"><div className="recommendation-head"><Sparkles size={18} /><strong>יש מקום לשפר את דמי הניהול בפנסיה שלך</strong></div><div className="recommendation-body"><div className="muted spread"><span>קרן פנסיה מקיפה</span><span>18/09/2026</span></div><h3>החיסכון שלך יכול לעבוד יותר בשבילך</h3><p>דמי הניהול בקרן הפנסיה שלך גבוהים ביחס לרמת השכר שלך. כדאי לבדוק אפשרות להוזלה.</p><button className="outline" onClick={onOpen}>לכל הפרטים <ArrowUpLeft size={15} /></button></div></article>;
}

function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const key = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const items = ref.current.querySelectorAll('button, select, input, [tabindex="0"]');
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}><section ref={ref} tabIndex={-1} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><header className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="סגירת חלון"><X /></button></header>{children}</section></div>;
}

function PensionDetails() {
  const [period, setPeriod] = useState('year');
  const series = period === 'year' ? returns : returns.slice(-6);
  return <><div className="detail-meta"><span>מספר חשבון <b>12345678</b></span><span>תאריך הצטרפות <b>31/01/2026</b></span><span>תאריך עדכון <b>18/09/2026</b></span><span className="status">פעיל</span></div><div className="details-grid">
    <div><section className="deposit-panel"><div className="spread"><div><span>סכום צבירה כולל</span><strong className="big-amount">{money(18686)}</strong></div><div><h3><TrendingUp size={17} /> הפקדות אחרונות</h3><p>תאריך הפקדה אחרון<br />01/07/2026</p></div></div><div className="deposit-chart" dir="ltr"><ResponsiveContainer width="100%" height="100%"><BarChart data={deposits} margin={{ top: 15, left: -18, right: 8, bottom: 12 }}><CartesianGrid vertical={false} stroke="#ffffff19" /><XAxis dataKey="month" stroke="#dedbf7" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={42} /><YAxis stroke="#dedbf7" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} domain={[0, 800]} /><Tooltip cursor={{ fill: '#ffffff10' }} formatter={v => [money(v), 'הפקדה']} contentStyle={{ borderRadius: 10, color: '#23213a' }} /><Bar dataKey="value" fill="#d5d0f1" radius={[5, 5, 5, 5]} barSize={14} /></BarChart></ResponsiveContainer></div></section><section className="blue-advice"><h3>המלצות NETWORTH <Sparkles size={17} /></h3><p>דמי הניהול בקרן הפנסיה הזאת גבוהים ביחס לרמת השכר שלך. מומלץ לבדוק אפשרות להוזלה.</p><small>תרחיש לדוגמה, אינו המלצה אישית</small></section></div>
    <div><div className="stat-grid">{[['דמי ניהול מצבירה', '0.22%'], ['דמי ניהול מהפקדה', '1%'], ['מסלול ההשקעה', 'מיטב פנסיה מקיפה מניות'], ['מעסיקים', 'חברה לדוגמה בע״מ']].map(([label, value]) => <section className="panel stat" key={label}><h3>{label}</h3><p>{value}</p></section>)}</div><section className="panel coverage"><h3>קצבאות במקרה נכות</h3><dl><div><dt>שיעור כיסוי</dt><dd>75%</dd></div><div><dt>קצבה</dt><dd>{money(4103)}</dd></div><div><dt>עלות</dt><dd>{money(13)}</dd></div></dl></section></div>
    <div><section className="panel returns-panel"><div className="spread"><span>תשואה מצטברת משוערת <b dir="ltr">{period === 'year' ? '15.64%' : '8.21%'}</b></span><select aria-label="תקופת תשואה" value={period} onChange={e => setPeriod(e.target.value)}><option value="year">שנה אחת</option><option value="half">חצי שנה</option></select></div><div className="returns-chart" dir="ltr"><ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{ top: 20, right: 10, left: -20, bottom: 15 }}><CartesianGrid vertical={false} stroke="#e8e8eb" /><XAxis dataKey="month" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={40} axisLine={false} tickLine={false} /><YAxis domain={[10, 30]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip formatter={(v, name) => [`${v}%`, name === 'fund' ? 'מסלול מניות' : 'מסלול לבני 50 ומטה']} /><Line type="monotone" dataKey="fund" stroke="#7d88e7" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="average" stroke="#b0b4ec" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div><div className="chart-legend"><span><i />מיטב פנסיה מקיפה מניות</span><span><i />מיטב פנסיה מקיפה לבני 50 ומטה</span></div></section><section className="panel survivors"><div className="spread"><h3>עלות כיסוי שאירים</h3><span>{money(3)}</span></div><div className="stat-grid">{[['אלמן/ה', '60%', 3282], ['יתום/ה', '40%', 2188]].map(([title, percentage, amount]) => <div key={title}><p>{title}</p><dl><div><dt>שיעור כיסוי</dt><dd>{percentage}</dd></div><div><dt>קצבה</dt><dd>{money(amount)}</dd></div></dl></div>)}</div></section></div>
  </div></>;
}

function Chat({ onClose }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const send = question => {
    if (!question.trim()) return;
    setMessages([...messages, { who: 'you', text: question }, { who: 'assistant', text: question.includes('דמי') ? 'בדוגמה הזאת דמי הניהול הם 1% מההפקדה ו־0.22% מהצבירה. אפשר לראות את שניהם בחלון פירוט הפנסיה, לצד מסלול ההשקעה וההפקדות האחרונות.' : 'בדוגמה שלך מוצג חיסכון של 18,686 ₪ בקרן פנסיה. במסך ״החסכונות שלך״ אפשר להשוות ולפתוח את הפירוט. זהו מענה לדוגמה — אין כאן חיבור לשירות AI או לנתונים אישיים.' }]);
    setInput('');
  };
  return <aside className="chat panel" aria-label="עוזר אישי לדוגמה"><header><strong>NETWORTH AI <Sparkles size={17} /></strong><button className="icon-button" onClick={onClose} aria-label="סגירת הצ׳אט"><X size={18} /></button></header><div className="chat-messages" aria-live="polite">{!messages.length ? <div className="chat-welcome"><div className="orb"><Sparkles /></div><h3>התמונה המלאה. בשיחה פשוטה.</h3><p>מה תרצה לדעת על החסכונות שלך?</p><small>תצוגת הדגמה · תשובות מוכנות מראש</small></div> : messages.map((m, i) => <div key={i} className={`message ${m.who}`}>{m.text}</div>)}</div><div className="suggestions"><button onClick={() => send('מה מצב החסכונות שלי?')}>מה מצב החסכונות שלי?</button><button onClick={() => send('כמה דמי ניהול אני משלם?')}>מהם דמי הניהול שלי?</button></div><form onSubmit={e => { e.preventDefault(); send(input); }}><input aria-label="שאלה לעוזר" value={input} onChange={e => setInput(e.target.value)} placeholder="אפשר לשאול אותי…" /><button className="icon-button" aria-label="שליחת שאלה" disabled={!input.trim()}><Send size={19} /></button></form></aside>;
}

export default function DesktopDemo() {
  const [page, setPage] = useState('home');
  const [collapsed, setCollapsed] = useState(false);
  const [modal, setModal] = useState(null);
  const [chat, setChat] = useState(false);
  const [copied, setCopied] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profile, setProfile] = useState({ name: 'דוד ישראלי', email: 'david@example.com', phone: '050-0000000' });
  const mainRef = useRef(null);
  const go = id => { setPage(id); mainRef.current?.scrollTo(0, 0); };
  const closeModal = React.useCallback(() => setModal(null), []);
  const openProduct = () => setModal('pension');
  const titles = { savings: ['החסכונות שלך', 'סוגי החסכונות שלך, דמי הניהול, מסלולי ההשקעה והצעות לשיפור'], insurance: ['הביטוחים שלך', 'כל הכיסויים שלך, במקום אחד. כדי שתדע בדיוק על מה אתה משלם.'], recommendations: ['המלצות NETWORTH', 'התמונה המלאה של החסכונות והביטוחים שלך — והאפשרויות לשפר אותם.'], share: ['משתפים חברים, מתקדמים יחד', 'כי גם לחברים שלך מגיע לראות את התמונה המלאה.'], profile: ['הפרופיל שלך', 'הפרטים שלך וההעדפות לאזור האישי'] };
  return <div className={`desktop-app ${collapsed ? 'collapsed' : ''}`}>
    <header className="topbar"><div className="brand-wrap"><button className="icon-button menu-button" aria-label={collapsed ? 'הרחבת תפריט' : 'צמצום תפריט'} onClick={() => setCollapsed(!collapsed)}><Menu size={23} /></button><button className="brand" onClick={() => go('home')}>NETWORTH<span className="brand-symbol" /></button></div><div className="account-area"><span className="demo-tag">תצוגת הדגמה</span><button className="account" onClick={() => go('profile')}><span className="avatar">ד</span>{profile.name}<ChevronDown size={14} /></button></div></header>
    <aside className="sidebar"><nav aria-label="תפריט ראשי">{nav.map(({ id, title, icon: Icon, badge }) => <button key={id} onClick={() => go(id)} className={`nav-item ${page === id ? 'active' : ''}`} aria-current={page === id ? 'page' : undefined} title={collapsed ? title : undefined}><span className="nav-icon"><Icon size={23} strokeWidth={1.45} />{badge && <b>{badge}</b>}</span><span className="nav-label">{title}</span></button>)}</nav><div className="sidebar-bottom"><span className="safe-dot" /><span className="nav-label">סביבת הדגמה מקומית</span></div></aside>
    <main ref={mainRef} className="main-content"><div className={`page-content page-${page}`}>
      {page === 'home' ? <><section className="greeting"><h1>היי {profile.name.split(' ')[0]}</h1><p>הנתונים מכל חברות הביטוח מרוכזים עבורך כאן. לכל שאלה ניתן להתייעץ עם סוכן ה־AI של<br className="desktop-break" /> NETWORTH</p><button className="primary" onClick={() => setChat(true)}>NETWORTH AI</button></section><div className="updated"><Info size={16} />הנתונים עודכנו בתאריך: 18/09/2026</div><div className="home-grid"><Ring title="החסכונות שלך" onClick={() => go('savings')} /><div className="home-left"><section className="panel analysis-panel"><h2>ניתחנו את התיק שלך</h2><div className="scale-labels"><span>נראה טוב</span><span>שווה בדיקה</span><span>ניתן לשפר</span></div><div className="scale"><span /></div><div className="spread"><span>1 המלצות NETWORTH</span><button className="text-link" onClick={() => go('recommendations')}>לצפייה בהמלצות</button></div></section><section className="panel insurance-summary"><h2>הביטוחים שלך</h2><div className="insurance-content"><ShieldPlus size={30} strokeWidth={1.3} /><div><h3>מכירים את הכיסוי שלך</h3><p>כל הביטוחים, העלויות והכיסויים במקום אחד</p></div><button className="icon-button" onClick={() => go('insurance')} aria-label="לפרטי הביטוחים"><ChevronLeft /></button></div></section></div></div><div className="section-heading"><h2>שווה לשים לב</h2><button className="text-link" onClick={() => go('recommendations')}>כל ההמלצות <ChevronLeft size={15} /></button></div><Recommendation onOpen={openProduct} /></> : <>
        <header className="page-heading"><h1>{titles[page][0]}</h1><p>{titles[page][1]}</p></header>
        {page === 'savings' && <><div className="savings-grid"><Ring onClick={openProduct} /><Comparison onSummary={salary => setModal(salary ? 'comparisonSalary' : 'comparison')} /></div><section className="products-section"><h2>קרן פנסיה</h2><div className="products-grid"><Product onOpen={openProduct} /></div><h2>חיסכון לכל ילד</h2><div className="products-grid"><Product child onOpen={() => setModal('child')} /></div></section></>}
        {page === 'recommendations' && <div className="recommendation-list"><Recommendation onOpen={openProduct} /></div>}
        {page === 'insurance' && <div className="insurance-layout"><section className="panel insurance-overview"><div className="shield-orbit"><ShieldPlus size={54} strokeWidth={1.2} /></div><h2>הכיסוי שלך, במבט אחד</h2><p>2 כיסויים פנסיוניים בתיק ההדגמה</p><strong>{money(16)}<small>עלות חודשית</small></strong></section><section className="panel insurance-list"><h2>הכיסויים בפנסיה שלך</h2>{[['קצבת נכות', '75% מהשכר המבוטח', 4103], ['קצבת שאירים', 'כיסוי לבני המשפחה', 3282]].map(([title, subtitle, amount]) => <button key={title} onClick={openProduct}><ShieldPlus size={23} /><span><b>{title}</b><small>{subtitle}</small></span><strong>{money(amount)}</strong><ChevronLeft size={18} /></button>)}<p className="muted">הנתונים כאן נועדו להמחשת הממשק בלבד.</p></section></div>}
        {page === 'share' && <section className="share-panel panel"><div className="gift-illustration"><Gift size={86} strokeWidth={1.1} /></div><h2>התמונה המלאה טובה יותר ביחד</h2><p>מזמינים חברים להכיר דרך פשוטה להבין את הכסף שלהם.</p><label>קישור לדוגמה<input readOnly value="https://example.com/networth-demo" dir="ltr" /></label><button className="primary" onClick={async () => { try { await navigator.clipboard.writeText('https://example.com/networth-demo'); setCopied(true); } catch { setModal('copy'); } }}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'הקישור הועתק' : 'העתקת קישור'}</button><small>קישור המחשה בלבד, ללא הזמנה אמיתית</small></section>}
        {page === 'profile' && <form className="panel profile-panel" onSubmit={e => { e.preventDefault(); setProfileSaved(true); }}><div className="profile-avatar">{profile.name[0]}</div><h2>נעים להכיר, {profile.name.split(' ')[0]}</h2>{[['name', 'שם מלא', 'text'], ['email', 'כתובת אימייל', 'email'], ['phone', 'טלפון נייד', 'tel']].map(([key, label, type]) => <label key={key}>{label}<input required type={type} value={profile[key]} onChange={e => { setProfile({ ...profile, [key]: e.target.value }); setProfileSaved(false); }} /></label>)}<button className="primary" type="submit">שמירת פרטים</button><p aria-live="polite" className="muted">{profileSaved ? 'הפרטים עודכנו בדוגמה עד לרענון הדף.' : 'הפרטים להמחשה בלבד ונשמרים רק בזיכרון הדף.'}</p></form>}
      </>}
      <footer className="page-footer">NETWORTH <span>·</span> דוגמה מקומית המבוססת על ההקלטה <span>·</span> הנתונים להמחשה בלבד</footer>
    </div></main>
    <button className="ai-fab orb" aria-label="פתיחת עוזר AI לדוגמה" onClick={() => setChat(!chat)}>{chat ? <X size={24} /> : <Sparkles size={24} />}</button>
    {chat && <Chat onClose={() => setChat(false)} />}
    {modal && <Modal title={modal === 'pension' ? 'קרן פנסיה מקיפה — מיטב' : modal.startsWith('comparison') ? 'סיכום ההשוואה שלך' : modal === 'child' ? 'חיסכון לכל ילד' : 'העתקת קישור'} wide={modal === 'pension'} onClose={closeModal}>{modal === 'pension' ? <PensionDetails /> : <div className="simple-modal"><div className="modal-symbol">{modal === 'child' ? <Wallet /> : <Sparkles />}</div>{modal.startsWith('comparison') ? <><h2>החיסכון שלך עומד על {money(18686)}</h2><p>בהשוואה לממוצע של {money(modal === 'comparisonSalary' ? 21500 : 24000)} בקבוצת ההשוואה לדוגמה. {modal === 'comparisonSalary' ? 'בהשוואה זו נלקחה בחשבון גם רמת השכר.' : 'אפשר להתאים את ההשוואה גם לרמת השכר.'}</p><p className="muted">זו המחשה חזותית בלבד, ולא השוואה למאגר נתונים אמיתי.</p></> : modal === 'child' ? <><h2>עדיין אין יתרה להצגה</h2><p>בדוגמה הזאת החשבון פעיל, אך עדיין לא התקבלו נתוני צבירה והפקדות.</p></> : <><p>אפשר לסמן ולהעתיק את הקישור ידנית:</p><input readOnly value="https://example.com/networth-demo" dir="ltr" onFocus={e => e.target.select()} /></>}<button className="primary" onClick={closeModal}>הבנתי</button></div>}</Modal>}
  </div>;
}

