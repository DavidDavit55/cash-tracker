import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { useMaslakaData } from '../hooks/useMaslakaData';
import { useIsPreviewRoute } from '../hooks/useIsPreviewRoute';
import PendingDataScreen from '../components/PendingDataScreen';
import { netWorthHistory, accounts, liabilities, pensionFunds, computeNetWorth } from '../mockData';

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

  if (maslakaLoading) return <div className="loading full">טוען...</div>;
  if (!hasRealData && !isPreview && !import.meta.env.DEV) {
    return <PendingDataScreen />;
  }

  const managersProducts = [...(insuranceOverride || []), ...(harBituachOverride || [])].filter(p => p.type === 'managers');
  const pensionItems = [...(pensionOverride || []), ...managersProducts];
  const pensionTotal = hasRealData
    ? pensionItems.reduce((s, p) => s + (p.balance || 0), 0)
    : pensionFunds.reduce((s, p) => s + p.balance, 0);
  const netWorth = hasRealData ? pensionTotal : computeNetWorth().netWorth;

  const categories = hasRealData
    ? PENSION_CATEGORY_ORDER.map(name => ({
        name,
        total: pensionItems.filter(p => pensionCategoryOf(p) === name).reduce((s, p) => s + (p.balance || 0), 0),
        color: '#22c55e',
      })).filter(cat => cat.total > 0)
    : [
      { name: 'עו"ש, חיסכון ופיקדונות', total: accounts.reduce((s, a) => s + a.balance, 0), color: '#6366f1' },
      { name: 'גמל ופנסיה', total: pensionTotal, color: '#22c55e' },
      { name: 'הלוואות ומשכנתא', total: -liabilities.reduce((s, l) => s + l.balance, 0), color: '#ef4444' },
    ];

  return (
    <div className="page">
      <div className="page-header">
        <h2>שלום, {user?.name} 👋</h2>
      </div>

      <div className="summary-card" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
        <div className="summary-amount">{fmt(netWorth)}</div>
        <div className="summary-label">השווי הנקי שלך</div>
      </div>

      <div className="chart-card" style={{ padding: '14px 0' }}>
        <h3 style={{ padding: '0 16px 10px' }}>פירוט לפי קטגוריה</h3>
        {categories.map((cat, i) => (
          <div key={i} style={{ padding: '10px 16px', borderBottom: i < categories.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
              <span style={{ fontWeight: 500 }}>{cat.name}</span>
              <span style={{ fontWeight: 700, color: cat.total < 0 ? '#ef4444' : cat.color, direction: 'ltr' }}>
                {cat.total < 0 ? '-' : ''}{fmt(Math.abs(cat.total))}
              </span>
            </div>
          </div>
        ))}
      </div>

      {hasRealData ? (
        <div className="chart-card">
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            כרגע מוצגים רק נתוני גמל/פנסיה שהתקבלו מהמסלקה. חיבור עו"ש, חסכונות והלוואות בפועל יתווסף בהמשך.
          </p>
        </div>
      ) : (
        <div className="chart-card">
          <h3>מגמת שווי נקי</h3>
          <ResponsiveContainer width="100%" height={180} dir="ltr">
            <LineChart data={netWorthHistory}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} domain={['dataMin - 5000', 'dataMax + 5000']} />
              <Tooltip formatter={v => fmt(v)} />
              <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
