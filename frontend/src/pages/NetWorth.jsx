import '../styles/networth-brand.css';
import '../tailwind.css';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { useMaslakaData } from '../hooks/useMaslakaData';
import { useIsPreviewRoute } from '../hooks/useIsPreviewRoute';
import PendingDataScreen from '../components/PendingDataScreen';
import PageSkeleton from '../components/Skeleton';
import { netWorthHistory, accounts, liabilities, pensionFunds, computeNetWorth } from '../mockData';
import { dedupById } from '../lib/dedupById';

const fmt = (n) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

// לכל פריט גמל/פנסיה יש בדיוק קטגוריה אחת מתוך אלה. חלק (פנסיה תקציבית, פוליסת חיסכון) לא
// ניתנות לזיהוי מהמסלקה בכלל (פנסיה תקציבית משולמת ישירות מתקציב המדינה, בלי קרן צבירה) -
// יוצגו ב-0 באמת, לא ניחוש.
const PENSION_CATEGORY_ORDER = [
  'פנסיה מקיפה', 'פנסיה משלימה', 'פנסיה תקציבית', 'קרן השתלמות', 'ביטוח מנהלים',
  'קופת גמל תגמולים ופיצויים', 'קופת גמל להשקעה', 'חיסכון לכל ילד', 'פוליסת חיסכון',
];

function pensionCategoryOf(p) {
  if (p.type === 'managers') return 'ביטוח מנהלים';
  if (p.type === 'pension') {
    if (p.pensionType === 'פנסיה משלימה כללית') return 'פנסיה משלימה';
    return 'פנסיה מקיפה';
  }
  if (p.productType === 'קרן השתלמות') return 'קרן השתלמות';
  if (p.productType === 'קופת גמל') return 'קופת גמל תגמולים ופיצויים';
  if (p.productType === 'גמל להשקעה') return 'קופת גמל להשקעה';
  if (p.productType === 'חיסכון לכל ילד') return 'חיסכון לכל ילד';
  return 'פוליסת חיסכון';
}

export default function NetWorth() {
  const { user } = useAuth();
  const { pensionOverride, insuranceOverride, harBituachOverride, loading: maslakaLoading } = useMaslakaData() || {};
  const isPreview = useIsPreviewRoute();
  const hasRealData = Boolean(pensionOverride) || Boolean(insuranceOverride) || Boolean(harBituachOverride);

  if (maslakaLoading) return <PageSkeleton title="שווי נקי" />;
  if (!hasRealData && !isPreview && !import.meta.env.DEV) {
    return <PendingDataScreen />;
  }

  const managersProducts = dedupById([...(insuranceOverride || []), ...(harBituachOverride || [])]).filter(p => p.type === 'managers');
  const pensionItems = [...(pensionOverride || []), ...managersProducts];
  const pensionTotal = hasRealData
    ? pensionItems.reduce((s, p) => s + (p.balance || 0), 0)
    : pensionFunds.reduce((s, p) => s + p.balance, 0);
  const netWorth = hasRealData ? pensionTotal : computeNetWorth().netWorth;

  const categories = hasRealData
    ? PENSION_CATEGORY_ORDER.map(name => ({
        name,
        total: pensionItems.filter(p => pensionCategoryOf(p) === name).reduce((s, p) => s + (p.balance || 0), 0),
        color: 'var(--nw-brand-green)',
      })).filter(cat => cat.total > 0)
    : [
      { name: 'עו"ש, חיסכון ופיקדונות', total: accounts.reduce((s, a) => s + a.balance, 0), color: '#A37E2C' },
      { name: 'גמל ופנסיה', total: pensionTotal, color: 'var(--nw-brand-green)' },
      { name: 'הלוואות ומשכנתא', total: -liabilities.reduce((s, l) => s + l.balance, 0), color: '#ef4444' },
    ];

  const CATEGORY_ICONS = {
    'עו"ש, חיסכון ופיקדונות': '🏦', 'הלוואות ומשכנתא': '🏠',
    'פנסיה מקיפה': '🛡️', 'פנסיה משלימה': '🛡️', 'פנסיה תקציבית': '🛡️',
    'קרן השתלמות': '🎓', 'ביטוח מנהלים': '💼',
    'קופת גמל תגמולים ופיצויים': '💰', 'קופת גמל להשקעה': '📈',
    'חיסכון לכל ילד': '🧒', 'פוליסת חיסכון': '📄', 'גמל ופנסיה': '🛡️',
  };

  const grossAssets = categories.reduce((s, c) => s + Math.max(c.total, 0), 0);
  const solvency = grossAssets > 0 ? Math.max(0, Math.min(1, netWorth / grossAssets)) : 1;
  const RING_R = 84;
  const RING_C = 2 * Math.PI * RING_R;

  return (
    <div style={{ background: '#f6f5f0', minHeight: '100vh', paddingBottom: '90px' }}>
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: '0.85rem', color: '#8a8067' }}>שלום,</div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a', margin: '2px 0 20px' }}>{user?.name || 'דוד'} 👋</h1>
      </div>

      <div className="networth-hero-grid" style={{ padding: '0 16px' }}>
      <div className="desktop-only-card" style={{ borderRadius: '20px', padding: '24px 20px', background: '#fff', border: '1px solid #eee7d6', boxShadow: '0 8px 24px -10px rgba(0,0,0,0.12)' }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '18px' }}>ניתחנו את התיק שלך</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#8a8067', marginBottom: '6px' }}>
          <span>יש מקום לשפר</span><span>סביר</span><span>מצוין</span>
        </div>
        <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(90deg, #dc4c3f, var(--nw-brand-gold), var(--nw-brand-green))', position: 'relative', marginBottom: '24px' }}>
          <div style={{ position: 'absolute', top: '-4px', right: `${(1 - solvency) * 100}%`, transform: 'translateX(50%)', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', border: '3px solid #1a1a1a' }} />
        </div>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '10px' }}>פירוט התיק</div>
        {categories.map((c, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '7px 0', borderBottom: i < categories.length - 1 ? '1px solid #f3efe3' : 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.total < 0 ? '#dc4c3f' : (i === 0 ? 'var(--nw-brand-green)' : 'var(--nw-brand-gold)') }} />
              {c.name}
            </span>
            <span style={{ direction: 'ltr' }}>{c.total < 0 ? '-' : ''}{fmt(Math.abs(c.total))}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          borderRadius: '20px', padding: '28px 20px',
          background: '#fff', border: '1px solid #eee7d6',
          boxShadow: '0 8px 24px -10px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', width: '200px', height: '200px' }}>
          <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="100" cy="100" r={RING_R} fill="none" stroke="#eee7d6" strokeWidth="14" />
            <circle
              cx="100" cy="100" r={RING_R} fill="none" stroke="var(--nw-brand-gold)" strokeWidth="14" strokeLinecap="round"
              strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - solvency)}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '140px', height: '140px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #0a7050, var(--nw-brand-green) 70%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 0 3px rgba(201,162,39,0.4)' }}>
              <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700 }}>{fmt(netWorth)}</div>
              <div style={{ color: 'var(--nw-brand-gold)', fontSize: '0.7rem', marginTop: '4px' }}>השווי הנקי שלך</div>
            </div>
          </div>
        </div>
        <span style={{ marginTop: '18px', background: 'rgba(201,162,39,0.14)', color: '#8a6d0f', border: '1px solid rgba(201,162,39,0.35)', borderRadius: '999px', padding: '8px 16px', fontSize: '0.78rem', fontWeight: 600 }}>
          🏆 מסלול פרימיום
        </span>
      </div>
      </div>

      <div style={{ padding: '24px 16px 8px', fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a' }}>פירוט לפי קטגוריה</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '0 16px' }}>
        {categories.map((cat, i) => {
          const isNeg = cat.total < 0;
          return (
            <div key={i} style={{ background: '#fff', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 10px -4px rgba(0,0,0,0.08)', border: '1px solid #eee7d6' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '10px', background: isNeg ? '#fdeceb' : '#eaf3ee' }}>
                {CATEGORY_ICONS[cat.name] || '💠'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#8a8067', marginBottom: '4px' }}>{cat.name}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: isNeg ? '#dc4c3f' : 'var(--nw-brand-green)', direction: 'ltr', textAlign: 'right' }}>
                {isNeg ? '-' : ''}{fmt(Math.abs(cat.total))}
              </div>
            </div>
          );
        })}
      </div>

      {hasRealData ? (
        <div style={{ margin: '20px 16px 0', background: '#fff', borderRadius: '16px', padding: '16px', border: '1px solid #eee7d6' }}>
          <p style={{ fontSize: '0.82rem', color: '#8a8067' }}>
            כרגע מוצגים רק נתוני גמל/פנסיה שהתקבלו מהמסלקה. חיבור עו"ש, חסכונות והלוואות בפועל יתווסף בהמשך.
          </p>
        </div>
      ) : (
        <div style={{ margin: '20px 16px 0', background: '#fff', borderRadius: '16px', padding: '16px', border: '1px solid #eee7d6' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '4px' }}>מגמת שווי נקי</h3>
          <ResponsiveContainer width="100%" height={180} dir="ltr">
            <LineChart data={netWorthHistory}>
              <defs>
                <linearGradient id="goldFade" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--nw-brand-gold)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--nw-brand-gold)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8a8067' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8a8067' }} domain={['dataMin - 5000', 'dataMax + 5000']} axisLine={false} tickLine={false} />
              <Tooltip formatter={v => fmt(v)} />
              <Line type="monotone" dataKey="value" stroke="var(--nw-brand-gold)" strokeWidth={3} dot={{ r: 4, fill: 'var(--nw-brand-gold)', strokeWidth: 0 }} fill="url(#goldFade)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
