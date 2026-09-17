import { insurancePolicies as mockInsurancePolicies, buildWhatsAppLink } from '../mockData';
import { useMaslakaData } from '../hooks/useMaslakaData';
import { useIsPreviewRoute } from '../hooks/useIsPreviewRoute';
import PendingDataScreen from '../components/PendingDataScreen';
import ProductCard, { fmt } from '../components/ProductCard';
import CoverageGapWidget from '../components/dashboard/CoverageGapWidget';
import { statusWarning } from '../lib/statusWarning';
import { dedupById } from '../lib/dedupById';

const CATEGORY_LABELS = [
  ['health', 'ביטוח בריאות'],
  ['life', 'ביטוחי חיים'],
  ['disability', 'אובדן כושר עבודה'],
  ['car', 'ביטוח רכב'],
  ['home', 'ביטוח דירה'],
  ['business', 'ביטוח עסק'],
  ['accident', 'ביטוח תאונות'],
  ['other', 'ביטוחים נוספים'],
];

export default function Protection() {
  const { pensionOverride, insuranceOverride, harBituachOverride, loading: maslakaLoading } = useMaslakaData() || {};
  const isPreview = useIsPreviewRoute();
  const hasRealData = Boolean(pensionOverride) || Boolean(insuranceOverride) || Boolean(harBituachOverride);

  if (maslakaLoading) return <div className="loading full">טוען...</div>;
  if (!hasRealData && !isPreview && !import.meta.env.DEV) {
    return <PendingDataScreen />;
  }

  // ביטוח מנהלים הוא בפועל מוצר חיסכון עם צבירה - מוצג בגמל ופנסיה, לא כאן.
  // לקוח אמיתי בלי נתוני ביטוח (העלה רק מסלקה פנסיה, למשל) לא אמור לראות מוקאפ - רק לקוח
  // ב-preview/DEV אמיתי (בלי חשבון) מקבל מוקאפ.
  const isRealAccount = hasRealData && !isPreview;
  const insurancePolicies = isRealAccount
    ? dedupById([...(insuranceOverride || []), ...(harBituachOverride || [])]).filter(p => p.type !== 'managers')
    : mockInsurancePolicies;
  const monthlyTotal = insurancePolicies.reduce((s, p) => s + (p.monthlyPremium || 0), 0);
  const hasHealthInsurance = insurancePolicies.some(p => p.type === 'health');

  if (isRealAccount && insurancePolicies.length === 0) {
    return (
      <div className="page">
        <div className="page-header"><h2>ההגנות שלי</h2></div>
        <div className="empty-state" style={{ marginTop: '60px' }}>
          <div className="empty-icon">🛡️</div>
          <h3 style={{ marginBottom: '8px' }}>עוד אין נתוני ביטוח</h3>
          <p>עדיין לא יובאו נתוני ביטוח (מסלקה או הר הביטוח) עבורך.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header"><h2>ההגנות שלי</h2></div>

      <div className="summary-card" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
        <div className="summary-amount" style={{ fontSize: '1.8rem' }}>{fmt(monthlyTotal)}</div>
        <div className="summary-label">פרמיה חודשית כוללת</div>
      </div>

      {!hasHealthInsurance && <CoverageGapWidget missingLabel="ביטוח בריאות פרטי" />}

      {isRealAccount ? (
        CATEGORY_LABELS.map(([type, label]) => {
          const items = insurancePolicies.filter(p => p.type === type);
          if (!items.length) return null;
          return (
            <div className="chart-card" style={{ padding: '14px 0' }} key={type}>
              <h3 style={{ padding: '0 16px 10px' }}>{label}</h3>
              {items.map((p, i) => (
                <ProductCard
                  key={p.id}
                  name={p.name}
                  subtitle={`${p.provider}${p.coverage ? ` • כיסוי ${fmt(p.coverage)}` : ''}`}
                  amount={p.monthlyPremium != null ? `${fmt(p.monthlyPremium)}/חודש` : 'לא ידוע'}
                  borderBottom={i < items.length - 1}
                  warning={statusWarning(p).warning}
                  warningText={statusWarning(p).warningText}
                  badge={p.pledgedTo ? 'משועבד' : null}
                  details={
                    <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingRight: '18px', margin: 0, lineHeight: 1.8 }}>
                      {p.coverageItems.map((c, j) => <li key={j}>{c}</li>)}
                    </ul>
                  }
                  ctaLabel="השווה עבורי"
                  ctaHref={buildWhatsAppLink(p.name, p.provider)}
                />
              ))}
            </div>
          );
        })
      ) : (
        <div className="chart-card" style={{ padding: '14px 0' }}>
          {insurancePolicies.map((p, i) => (
            <ProductCard
              key={p.id}
              name={p.name}
              subtitle={`${p.provider}${p.coverage ? ` • כיסוי ${fmt(p.coverage)}` : ''}`}
              amount={p.monthlyPremium != null ? `${fmt(p.monthlyPremium)}/חודש` : 'לא ידוע'}
              borderBottom={i < insurancePolicies.length - 1}
              details={
                <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingRight: '18px', margin: 0, lineHeight: 1.8 }}>
                  {p.coverageItems.map((c, j) => <li key={j}>{c}</li>)}
                </ul>
              }
              ctaLabel="השווה עבורי"
              ctaHref={buildWhatsAppLink(p.name, p.provider)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
