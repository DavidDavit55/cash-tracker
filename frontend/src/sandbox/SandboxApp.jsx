import ProductReview, { ReviewHealth } from '../components/ProductReview';
import { reviewProducts } from '../lib/productReview';
import { loadClientPreview } from './loadClientPreview';
import BrandLogo from './BrandLogo';
import ClientReview from './ClientReview';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Home, Wallet, ShieldPlus, Sparkles, Database, TrendingUp, UserRound, Menu, ChevronLeft, X, FlaskConical, ShieldCheck, RefreshCw, FileUp, ExternalLink, Search, ArrowUpLeft, Info } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { makeDemo, portfolio, money, percent } from './model';
import { loadClient, setSandboxToken } from './api';
import ProductStatus from './ProductStatus';
import { buildCalendlyLink } from '../mockData';
import DataPanel from './DataPanel';
import FundDetails from './FundDetails';
import PerformanceRecommendation from './PerformanceRecommendation';
import usePerformanceRecommendations from './usePerformanceRecommendations';
import Cashflow from './Cashflow';
import Onboarding from './Onboarding';
import InsurerLogo from './InsurerLogo';
import RecommendationIdentity from './RecommendationIdentity';
import { productKey, displayProductNumber } from './productIdentity';
import { isCompensationPolicy, showCoverageAmount } from './insuranceCoverage';
import './forest-base.css';
import './sandbox.css';

const colors = ['#173F35', '#246653', '#B69A58', '#B7CDBF', '#60796C'];
const emptySnapshot = { source: 'empty', pension_data: [], insurance_data: [], har_bituach_data: [], client_info: {}, profile: {}, warnings: [] };
const items = [
  ['home', 'מבט מהיר', Home], ['savings', 'החסכונות שלך', Wallet], ['insurance', 'הביטוחים שלך', ShieldPlus],
  ['recommendations', 'המלצות לשיפור', Sparkles], ['cashflow', 'תזרים ותקציב', TrendingUp], ['profile', 'הפרופיל שלך', UserRound], ['data', 'חיבור נתונים', Database],
];
const headings = {
  savings: ['החסכונות שלך', 'כל המוצרים שהתקבלו בתיק, דמי הניהול, המסלולים והאפשרויות לשיפור.'],
  insurance: ['הביטוחים שלך', 'נתוני המסלקה והר הביטוח, באותה תמונה.'],
  recommendations: ['המלצות לשיפור', 'ביצועי המסלולים ודמי הניהול — נקודות לבדיקה על בסיס הנתונים בתיק.'],
  cashflow: ['תזרים ותקציב', 'הנתונים הקיימים של החשבון שלך, עם מרחב לניסוי מקומי.'],
  profile: ['הפרופיל שלך', 'פרטי הלקוח של התיק המוצג.'],
  data: ['מחברים את התמונה המלאה', 'הנתונים והחיבורים של NETWORTH, בסביבת עבודה נפרדת.'],
};
const policyTypes = { health: 'בריאות', life: 'חיים', disability: 'אובדן כושר עבודה', car: 'רכב', home: 'דירה', business: 'עסק', accident: 'תאונות', other: 'ביטוחים נוספים' };

function Modal({ title, provider, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    const handle = event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const elements = [...ref.current.querySelectorAll('button:not(:disabled),a[href],input,select,[tabindex="0"]')];
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handle);
    return () => { document.removeEventListener('keydown', handle); previous?.focus(); };
  }, [onClose]);
  return <div className="sb-dialog-backdrop" onClick={e => e.currentTarget === e.target && onClose()}><section ref={ref} tabIndex={-1} className={`sb-dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><header className="sb-dialog-head"><div className="sb-modal-title">{provider && <InsurerLogo provider={provider} />}<h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="סגירת חלון"><X /></button></header>{children}</section></div>;
}
function RecommendationQuestions() {
  return <section className="panel sb-empty sb-recommendation-questions"><Sparkles size={33} /><h2>יש משהו נוסף שתרצה להבין בתיק שלך?</h2><p>שאלה על החיסכון, הביטוחים או הצעד הבא? נשמח לעשות סדר ולענות על מה שחשוב לך.</p><a className="primary" href={buildCalendlyLink()} target="_blank" rel="noreferrer">בוא נדבר <ExternalLink size={15} /></a></section>;
}
function Empty({ title = 'עדיין אין נתונים להצגה', onData }) {
  return <section className="panel sb-empty"><Database size={33} /><h2>{title}</h2><p>הנתונים יופיעו כאן לאחר השלמת הכנת התיק.</p><button className="primary" onClick={onData}>לחיבור נתונים <ChevronLeft size={15} /></button></section>;
}
function PortfolioRing({ data, onSavings }) {
  return <section className="panel ring-panel sb-ring"><h2>החסכונות שלך</h2><button className="sb-ring-chart" onClick={onSavings} aria-label="הצגת כל החסכונות"><ResponsiveContainer width="100%" height="100%"><PieChart accessibilityLayer={false} tabIndex={-1}><Pie tabIndex={-1} data={data.total > 0 ? data.categories.filter(c => c.value > 0) : [{ name: 'אין צבירה מדווחת', value: 1 }]} dataKey="value" innerRadius="84%" outerRadius="96%" startAngle={90} endAngle={-270} strokeWidth={0} isAnimationActive={false}>{(data.total > 0 ? data.categories.filter(c => c.value > 0) : [{}]).map((_, i) => <Cell key={i} fill={data.total > 0 ? colors[i % colors.length] : '#e9e6f5'} />)}</Pie></PieChart></ResponsiveContainer><span><strong>{money(data.total)}</strong><small>צבירה מדווחת בתיק</small></span></button><div className="sb-ring-legend">{data.categories.map((c, i) => <span key={c.name}><i style={{ background: colors[i % colors.length] }} />{c.name}</span>)}</div><p className="sb-source-note">{data.unknownBalances ? `${data.unknownBalances} מוצרים ללא צבירה מדווחת אינם כלולים בסכום.` : 'הסכום מתייחס למוצרי החיסכון שהתקבלו בלבד.'}</p></section>;
}
function Product({ fund, snapshot }) {
  const [expanded, setExpanded] = useState(false);
  return <article className="panel sb-horizontal-product">
    <div className="sb-product-summary">
      <div className="sb-product-identity"><InsurerLogo provider={fund.provider} fallback="חברה מנהלת" /><ProductStatus product={fund} /></div>
      <div className="sb-product-balance"><span>החיסכון שנצבר</span><strong>{money(fund.balance)}</strong><small>מוצר {displayProductNumber(fund.id)}</small></div>
      <dl className="sb-product-metrics"><div><dt>דמי ניהול מהפקדה</dt><dd>{percent(fund.feeFromDeposit)}</dd></div><div><dt>דמי ניהול מצבירה</dt><dd>{percent(fund.feeFromAccumulation)}</dd></div><div><dt>מסלול השקעה</dt><dd>{fund.investmentTrack || 'לא התקבל'}</dd></div></dl>
      <button className="primary small" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'סגירת הפרטים' : 'לכל הפרטים'}<ChevronLeft size={15} style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(-90deg)' }} /></button>
    </div>
    {expanded && <div className="sb-product-expanded"><h3>{fund.name || 'פרטי המוצר'}</h3><FundDetails fund={fund} snapshot={snapshot} /></div>}
  </article>;
}
function Recommendation({ recommendation, onOpen }) {
  if (recommendation.kind === 'performance') return <PerformanceRecommendation fund={recommendation.fund} result={recommendation.result} onOpen={onOpen} />;
  const { fund, kind } = recommendation;
  if (kind === 'consolidation') return <article className="panel recommendation"><div className="recommendation-head"><Wallet size={19} /><strong>כדאי לבדוק איחוד קרנות פנסיה</strong></div><div className="recommendation-body"><h3>{money(recommendation.balance)} בקרנות פנסיה לא פעילות</h3><p>בתיק מופיעה קרן פנסיה פעילה אחת: {fund.provider} · {fund.name}. לצד הקרן הפעילה נשארו כספים ב־{recommendation.inactive.length} קרנות לא פעילות.</p><p>ריכוז החיסכון עשוי להקל על המעקב והניהול. כדאי לבחון אם מתאים להעביר את היתרות לקרן הפעילה, לאחר השוואת דמי הניהול, מסלולי ההשקעה, התנאים והכיסויים הביטוחיים.</p><ul>{recommendation.inactive.map(item => <li key={productKey(item)}>{item.provider} · {item.name} — {money(item.balance)} <button className="text-link" onClick={() => onOpen(item)}>לפרטי הקרן</button></li>)}</ul><p className="sb-source-note">הזיהוי מבוסס על הסטטוס והיתרה המדווחים בתיק. איחוד אינו מבטיח חיסכון בעלויות; לפני העברה יש לבדוק שמירה על זכויות וכיסוי ביטוחי.</p><button className="outline" onClick={() => onOpen(fund)}>לבדיקת הקרן הפעילה</button></div></article>;
  if (kind === 'age') return <article className="panel recommendation"><div className="recommendation-head"><TrendingUp size={19} /><strong>האם מסלול ההשקעה עדיין מתאים לך?</strong></div><div className="recommendation-body"><RecommendationIdentity fund={fund} /><h3>{fund.investmentTrack}</h3><p>החיסכון נמצא במסלול המבוסס על קבוצת גיל או שנת פרישה צפויה. כדאי לבדוק שרמת הסיכון מתאימה לטווח החיסכון, למטרות ולהעדפות שלך כיום — ולא להסתפק בהתאמה לפי גיל בלבד. עצם הבחירה במסלול אינה סיבה אוטומטית לעבור.</p><button className="outline" onClick={() => onOpen(fund)}>לפרטי המסלול</button></div></article>;
  return <article className="panel recommendation"><div className="recommendation-head"><Sparkles size={19} /><strong>כדאי לבדוק אפשרות להפחתת דמי הניהול</strong></div><div className="recommendation-body"><RecommendationIdentity fund={fund} /><h3>כדאי לבחון את דמי הניהול ביחס לבסיס ההשוואה שלנו.</h3><p>ייתכן שאפשר להוזיל אותם — רוצה לשמוע איך?</p><button className="outline" onClick={() => onOpen(fund)}>לבדיקה ולפירוט <ArrowUpLeft size={15} /></button></div></article>;
}

export default function SandboxApp({ initialSnapshot, clientMode = false, onSignOut } = {}) {
  const [snapshot, setSnapshot] = useState(() => {
    if (initialSnapshot) return initialSnapshot;
    if (clientMode || new URLSearchParams(location.search).has('client')) return emptySnapshot;
    return makeDemo();
  });
  const clientView = clientMode || new URLSearchParams(location.search).has('client');
  const [auth, setAuth] = useState(null);
  const readPage = useCallback(() => { const id = location.hash.slice(1); return items.some(([key]) => key === id) && !(clientView && ['data', 'cashflow'].includes(id)) ? id : !clientView && new URLSearchParams(location.search).has('onboarding') ? 'onboarding' : 'home'; }, [clientView]);
  const [page, setPage] = useState(readPage);

  const [onboarding, setOnboarding] = useState({ step: 0, selected: [] });
  const [collapsed, setCollapsed] = useState(false);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(() => !initialSnapshot && clientView);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const main = useRef(null);
  useEffect(() => { const navigate = () => { setPage(readPage()); setModal(null); main.current?.scrollTo(0, 0); }; window.addEventListener('hashchange', navigate); return () => window.removeEventListener('hashchange', navigate); }, [readPage]);

  useEffect(() => {
    if (!clientView || initialSnapshot) return;
    const controller = new AbortController();
    loadClientPreview(controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setSnapshot(value); setRevision(r => r + 1);
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [clientView, initialSnapshot]);
  const performance = usePerformanceRecommendations(snapshot);
  const baseData = portfolio(snapshot);
  const data = { ...baseData, recommendations: clientView && ['sandbox', 'production'].includes(snapshot.source) ? [] : [...performance.recommendations, ...baseData.recommendations] };
  const name = [snapshot.client_info?.first, snapshot.client_info?.last].filter(Boolean).join(' ') || snapshot.displayName || snapshot.profile?.name || (snapshot.source === 'file' ? 'לקוח מקובץ' : 'לקוח');
  const sourceLabel = snapshot.source === 'live' ? 'נתונים מהמערכת · קריאה בלבד' : ['sandbox', 'production'].includes(snapshot.source) ? 'תיק סנדבוקס · שמור מקומית' : snapshot.source === 'file' ? 'נתונים מקובץ · מקומי בלבד' : snapshot.source === 'demo' ? 'תיק הדגמה' : busy ? 'טוען נתונים…' : 'אין תיק טעון';
  const go = id => { const next = clientView && ['data', 'onboarding', 'cashflow'].includes(id) ? 'home' : id; location.hash = next; setPage(next); main.current?.scrollTo(0, 0); };
  const close = useCallback(() => setModal(null), []);
  const showFund = fund => setModal({ type: 'fund', fund });
  const applySnapshot = value => {
    generation.current++; setBusy(false); setError(''); setSnapshot(value); setRevision(r => r + 1); setModal(null); setSearch(''); if (page === 'onboarding') setOnboarding(draft => ({ ...draft, step: 3 })); else go('home'); };
  const onLoad = async (clientId = '', displayName = '') => {
    const current = ++generation.current;
    setBusy(true); setError(''); setSnapshot(emptySnapshot); setModal(null); setRevision(r => r + 1);
    try {
      const next = await loadClient(clientId);
      if (current !== generation.current) return;
      setSnapshot({ ...next, displayName }); if (page === 'onboarding') setOnboarding(draft => ({ ...draft, step: 3 })); else go('home');
    } catch (e) { if (current === generation.current) { setError(e.status === 401 ? 'החיבור פג או אינו תקין. יש להתחבר מחדש.' : e.message); if (page !== 'onboarding') go('data'); } }
    finally { if (current === generation.current) setBusy(false); }
  };
  const logout = () => { setSandboxToken(''); setAuth(null); applySnapshot(emptySnapshot); go('data'); };
  const filtered = data.funds.filter(f => `${f.name} ${f.provider} ${f.investmentTrack}`.toLowerCase().includes(search.toLowerCase()));

  if (!clientView && page === 'onboarding') return <div className="sb-app"><Onboarding draft={onboarding} onDraft={setOnboarding} snapshot={snapshot} busy={busy} onClose={() => go('home')} onFinish={go}><DataPanel auth={auth} onAuth={setAuth} onLogout={logout} snapshot={snapshot} onSnapshot={applySnapshot} onLoad={onLoad} onDemo={() => applySnapshot(makeDemo())} busy={busy} loadError={error} /></Onboarding></div>;
  return <div className={`desktop-app sb-app ${clientView ? 'sb-client-view' : ''} ${snapshot.source === 'file' ? 'sb-client-loaded' : ''} ${collapsed ? 'collapsed' : ''}`}>
    <div className="sb-banner"><span><FlaskConical size={14} />NETWORTH SANDBOX</span><span>סביבת עבודה מקומית · הפרודקשן נשמר</span><a href="https://networth.davit-fin.co.il" target="_blank" rel="noreferrer">הגרסה המקורית <ExternalLink size={12} /></a></div>
    <header className="topbar"><div className="brand-wrap"><button className="icon-button menu-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'הרחבת תפריט' : 'צמצום תפריט'}><Menu size={23} /></button><button className="brand" onClick={() => go('home')} aria-label="NETWORTH — דף הבית"><BrandLogo /></button></div><div className="account-area">{onSignOut && <button onClick={onSignOut}>יציאה</button>}<button className="ob-launch" onClick={() => { window.location.href = '/sandbox.html?register'; }}>מתחילים כאן <Sparkles size={15} /></button><span className={`sb-source-badge ${snapshot.source}`}>{sourceLabel}</span><button className="account" onClick={() => go('profile')}><span className="avatar">{name[0]}</span>{name}</button></div></header>
    <aside className="sidebar"><nav aria-label="תפריט ראשי">{items.filter(([id]) => !clientView || !['data', 'cashflow'].includes(id)).map(([id, label, Icon]) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => go(id)} title={collapsed ? label : undefined}><span className="nav-icon"><Icon size={23} strokeWidth={1.4} />{id === 'recommendations' && data.recommendations.length > 0 && <b>{data.recommendations.length}</b>}</span><span className="nav-label">{label}</span></button>)}</nav><div className="sidebar-bottom"><ShieldCheck size={15} /><span className="nav-label">אין כתיבה לפרודקשן</span></div></aside>
    <main ref={main} className="main-content"><div className={`page-content sb-page page-${page}`}>
      <div className="sb-context-bar"><div><span className={`sb-source-dot ${snapshot.source}`} /><strong>{sourceLabel}</strong>{snapshot.source !== 'demo' && snapshot.loadedAt && <small>נטען {new Date(snapshot.loadedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</small>}</div><div><button disabled={busy} onClick={() => go('data')}><Database size={15} />{snapshot.source === 'demo' ? 'חיבור הנתונים שלי' : 'בחירת מקור נתונים'}</button>{snapshot.source === 'live' && <button disabled={busy} onClick={() => onLoad(snapshot.clientId, name)} aria-label="רענון הנתונים"><RefreshCw size={15} /></button>}</div></div>
      {performance.unavailable > 0 && !['sandbox', 'production'].includes(snapshot.source) && <p role="status" className="sb-inline-message">לא הושלמה השוואת התשואות עבור {performance.unavailable} מוצרים. אין בכך אישור שהביצועים תקינים.</p>}{busy && <div className="sb-loading" role="status">טוען את התיק שלך…</div>}
      {clientView && error && <p role="alert">{error}</p>}{snapshot.warnings?.map(warning => <div className="sb-inline-message" key={warning}>{warning}</div>)}
      {page === 'home' ? <><section className="greeting sb-greeting"><h1>היי {name.split(' ')[0]}</h1><p>החסכונות, הביטוחים והאפשרויות לשיפור — כל התמונה שלך במקום אחד.</p><div className="sb-button-row"><button className="primary" onClick={() => go('data')}><FileUp size={16} />{snapshot.source === 'demo' ? 'בוא נחבר את התיק שלך' : 'ניהול מקורות הנתונים'}</button><button className="text-link" onClick={() => go('savings')}>לכל החסכונות <ChevronLeft size={14} /></button></div></section><div className="updated"><Info size={15} />{snapshot.source === 'demo' ? 'נתוני הדגמה · אותם סוגי מוצרים ושדות של המערכת הקיימת' : 'מוצגים הנתונים שהתקבלו בלבד · ללא הוספת נתוני דוגמה'}</div>
      {snapshot.source === 'empty' ? <Empty onData={() => go('data')} /> : <>{snapshot.review?.assessments && <ReviewHealth products={reviewProducts(snapshot)} assessments={snapshot.review.assessments}/>}<div className="home-grid"><PortfolioRing data={data} onSavings={() => go('savings')} /><div className="home-left"><section className="panel analysis-panel sb-analysis"><h2>{['sandbox', 'production'].includes(snapshot.source) ? snapshot.review ? 'המלצות הסוכן מוכנות' : 'התיק ממתין לבדיקה' : 'נקודות לבדיקה בתיק שלך'}</h2><div className="sb-analysis-count"><Sparkles size={25} />{['sandbox', 'production'].includes(snapshot.source) ? <span>{snapshot.review ? 'הסוכן בדק את התיק ופרסם עבורך המלצות' : 'לאחר בדיקת הסוכן ההמלצות יופיעו כאן'}</span> : <><strong>{data.recommendations.length}</strong><span>נושאים לבדיקה בתיק שלך</span></>}</div><div className="spread"><small>{data.funds.length} מוצרי חיסכון בתיק</small><button className="text-link" onClick={() => go('recommendations')}>לצפייה בהמלצות</button></div></section><button type="button" className="panel insurance-summary sb-insurance-summary-link" onClick={() => go('insurance')} aria-label="לפרטי הביטוחים"><span className="sb-summary-title">הביטוחים שלך</span><div className="insurance-content"><ShieldPlus size={30} /><div><span className="sb-summary-count">{data.policies.length} פוליסות בתיק</span><p>{money(data.premium)} פרמיה חודשית מדווחת{data.unknownPremiums ? ` · ${data.unknownPremiums} ללא פרמיה` : ''}</p></div><span className="icon-button" aria-hidden="true"><ChevronLeft /></span></div></button></div></div><section className="sb-kpis">{data.categories.map((category, i) => <button className="panel" key={category.name} onClick={() => go('savings')}><span><i style={{ background: colors[i % colors.length] }} />{category.name}</span><strong>{money(category.value)}</strong><small>{category.items.length} מוצרים</small></button>)}</section><div className="section-heading"><h2>שווה לבדוק</h2><button className="text-link" onClick={() => go('recommendations')}>כל האפשרויות <ChevronLeft size={15} /></button></div><div className="sb-recommendation-grid">{data.recommendations.slice(0, 2).map(r => <Recommendation key={`${r.kind || "fees"}:${productKey(r.fund)}`} recommendation={r} onOpen={showFund} />)}{!data.recommendations.length && !performance.loading && <RecommendationQuestions />}</div></>}
      </> : <><header className="page-heading"><h1>{headings[page][0]}</h1><p>{headings[page][1]}</p></header>
      {!clientView && page === 'data' && <DataPanel auth={auth} onAuth={setAuth} onLogout={logout} snapshot={snapshot} onSnapshot={applySnapshot} onLoad={onLoad} onDemo={() => applySnapshot(makeDemo())} busy={busy} loadError={error} />}
      {page === 'savings' && <>{data.funds.length ? <><div className="savings-grid"><PortfolioRing data={data} onSavings={() => document.getElementById('sb-products')?.scrollIntoView({ behavior: 'smooth' })} /><section className="panel sb-allocation"><h2>איך החיסכון שלך מתחלק?</h2>{data.categories.map((category, i) => <div className="sb-allocation-row sb-allocation-link" role="button" tabIndex={0} aria-label={`למוצרים בקטגוריית ${category.name}`} onClick={() => { setSearch(''); requestAnimationFrame(() => document.getElementById(`sb-category-${category.name}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} key={category.name}><div className="spread"><span>{category.name}</span><strong>{money(category.value)}</strong></div><div className="sb-allocation-track"><span style={{ width: `${data.total ? category.value / data.total * 100 : 0}%`, background: colors[i % colors.length] }} /></div><small>{category.items.length} מוצרים</small></div>)}<p className="sb-source-note">לא מחובר מאגר השוואת עמיתים. ההרכב כאן מחושב מהתיק עצמו.</p></section></div><section className="products-section" id="sb-products"><div className="sb-search"><Search size={18} /><input aria-label="חיפוש מוצר חיסכון" placeholder="חיפוש חברה, מוצר או מסלול" value={search} onChange={e => setSearch(e.target.value)} /></div>{data.categories.map(category => { const funds = category.items.filter(f => filtered.includes(f)); if (funds.every(f => f.type === 'pension')) funds.sort((a, b) => Number(b.status?.trim() === 'פעיל') - Number(a.status?.trim() === 'פעיל') || (Number(b.balance) || 0) - (Number(a.balance) || 0)); return funds.length > 0 && <section className="sb-product-group" id={`sb-category-${category.name}`} key={category.name}><h2>{category.name} <span>{funds.length}</span></h2><div className="products-grid">{funds.map(fund => <Product key={productKey(fund)} fund={fund} snapshot={snapshot} />)}</div></section>; })}{!filtered.length && <p className="sb-empty-small">לא נמצאו מוצרים לחיפוש הזה</p>}</section></> : <Empty title="לא התקבלו מוצרי חיסכון" onData={() => go('data')} />}</>}
      {page === 'insurance' && <>{data.policies.length ? <><section className="sb-insurance-hero panel"><ShieldPlus size={43} strokeWidth={1.2} /><div><span>הפרמיה החודשית המדווחת</span><strong>{money(data.premium)}</strong><small>{data.policies.length} פוליסות{data.unknownPremiums > 0 ? ` · ${data.unknownPremiums} ללא פרמיה מדווחת` : ''}</small></div><p>פוליסות משותפות למסלקה ולהר הביטוח מאוחדות לפי מזהה, באמצעות הלוגיקה הקיימת.</p></section>{!data.policies.some(p => p.type === 'health') && <div className="sb-inline-message"><Info size={17} />לא נמצא ביטוח בריאות בנתונים שהתקבלו. אין בכך הוכחה שאין כיסוי מחוץ לתיק.</div>}{Object.entries(policyTypes).map(([type, label]) => { const policies = data.policies.filter(p => (p.type || 'other') === type); return policies.length > 0 && <section className="sb-product-group" key={type}><h2>{label}</h2><div className="products-grid">{policies.map(policy => <button className="panel sb-policy-card" key={productKey(policy)} onClick={() => setModal({ type: 'insurance', policy })}><div className="spread"><InsurerLogo provider={policy.provider} /><ProductStatus product={policy} /></div><h3>{policy.name}</h3>{(policy.isCollective || policy.groupClassification) && <span className="sb-collective-badge">קולקטיב</span>}<p>{policy.provider}</p><strong>{money(policy.monthlyPremium)}<small> / חודש</small></strong><div className="spread"><span>לפירוט כיסויים</span><ChevronLeft size={17} /></div></button>)}</div></section>; })}</> : <Empty title="לא התקבלו נתוני ביטוח" onData={() => go('data')} />}</>}
      {page === 'recommendations' && clientView && ['sandbox', 'production'].includes(snapshot.source) ? <section className="panel sb-published-review"><h2>{snapshot.review ? 'המלצות הסוכן שלך' : 'התיק ממתין לבדיקת הסוכן'}</h2>{snapshot.review ? <><p>{snapshot.review.agentName} · {new Date(snapshot.review.publishedAt).toLocaleDateString('he-IL')}</p><div style={{whiteSpace:'pre-wrap'}}>{snapshot.review.text}</div>{snapshot.review.assessments && <ProductReview products={reviewProducts(snapshot)} assessments={snapshot.review.assessments}/>}<a className="primary" href={buildCalendlyLink()} target="_blank" rel="noreferrer">לתיאום שיחה</a></> : <p>לאחר בדיקת התיק ואישור ההמלצות הן יופיעו כאן.</p>}</section> : page === 'recommendations' && <ClientReview clientView={clientView} agentName={snapshot.review?.agentName}>{performance.loading && <p role="status">בודקים את ביצועי המסלולים… המלצות יתווספו רק אם נמצאה תשואה נמוכה מהממוצע.</p>}{data.recommendations.length ? <><div className="sb-recommendation-grid">{data.recommendations.map(r => <Recommendation key={`${r.kind || "fees"}:${productKey(r.fund)}`} recommendation={r} onOpen={showFund} />)}</div><p className="sb-source-note">השוואת התשואות מתייחסת למסלולים דומים ולתקופות דיווח זהות. המלצות דמי הניהול מופיעות כשיש מקום לבדוק אפשרות להוזלה. אלו נושאים לבדיקה ולא הוראה לביצוע שינוי בתיק.</p></> : !performance.loading && (data.funds.length || data.policies.length ? <RecommendationQuestions /> : <Empty onData={() => go('data')} />)}</ClientReview>}
      {page === 'cashflow' && <Cashflow key={`${revision}-${auth?.id || 'none'}`} auth={auth} snapshot={snapshot} />}
      {page === 'profile' && <section className="panel sb-profile"><div className="profile-avatar">{name[0]}</div><h2>{name}</h2><span className="sb-source-badge">{sourceLabel}</span><dl>{[['אימייל', snapshot.profile?.email], ['טלפון', snapshot.profile?.phone], ['תאריך לידה', snapshot.client_info?.birth || snapshot.profile?.birth_date?.slice(0, 10)], ['הכנסה חודשית', snapshot.profile?.monthly_income != null ? money(snapshot.profile.monthly_income) : null], ['סטטוס תיק', snapshot.profile?.status]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'לא התקבל'}</dd></div>)}</dl><p>תצוגת הפרופיל היא לקריאה בלבד. פרטי הזדהות וחתימות לא מועתקים למסכי העיצוב.</p><button className="primary" onClick={() => go('data')}>בחירת תיק ומקור נתונים</button></section>}
      </>}
      <footer className="page-footer">NETWORTH <span>·</span> סביבת פיתוח לדסקטופ <span>·</span> מקור: {sourceLabel}</footer>
    </div></main>
    <button className="ai-fab orb" aria-label="מידע על הסנדבוקס" onClick={() => setModal({ type: 'help' })}><FlaskConical size={23} /></button>
    {modal && <Modal provider={modal.type === 'fund' ? modal.fund.provider : null} title={modal.type === 'fund' ? `${modal.fund.name} · ${modal.fund.provider}` : modal.type === 'insurance' ? modal.policy.name : 'סביבת העבודה החדשה שלך'} wide={modal.type === 'fund'} onClose={close}>{modal.type === 'fund' ? <FundDetails key={`${productKey(modal.fund)}-${revision}`} fund={modal.fund} snapshot={snapshot} /> : modal.type === 'insurance' ? <section className="simple-modal sb-insurance-detail"><InsurerLogo provider={modal.policy.provider} /><h2>{modal.policy.provider}</h2>{(modal.policy.isCollective || modal.policy.groupClassification) && <p className="sb-collective-badge">קולקטיב · {modal.policy.groupClassification || 'ביטוח קבוצתי'}</p>}<dl><div><dt>פרמיה חודשית</dt><dd>{money(modal.policy.monthlyPremium)}</dd></div>{showCoverageAmount(modal.policy) && <div><dt>{isCompensationPolicy(modal.policy) ? 'סכום פיצוי' : 'סכום כיסוי'}</dt><dd>{money(modal.policy.coverage)}</dd></div>}<div><dt>מספר פוליסה</dt><dd>{displayProductNumber(modal.policy.id)}</dd></div></dl><ul>{(modal.policy.coverageItems || ['לא התקבלו פרטי כיסוי נוספים']).map((item, i) => <li key={i}>{item}</li>)}</ul>{modal.policy.pledgedTo && <p>משועבד ל: {modal.policy.pledgedTo}</p>}<a className="primary" href={buildCalendlyLink()} target="_blank" rel="noreferrer">לתיאום פגישה <ExternalLink size={15} /></a></section> : <section className="simple-modal"><FlaskConical size={35} /><h2>אותם נתונים, מרחב חדש לעבוד</h2><p>הגרסה המקורית נשמרה. כאן אפשר לחבר תיק קיים, לפענח קבצים ולבחון את העיצוב החדש.</p><p>אין בסנדבוקס פעולות כתיבה לפרודקשן. שליחת קוד הכניסה מתבצעת רק בלחיצה שלך. הנתונים והחיבור נשמרים בזיכרון הלשונית ונמחקים ברענון.</p><button className="primary" onClick={() => { close(); go('data'); }}>לחיבור הנתונים</button></section>}</Modal>}
  </div>;
}

import './client-view.css';
