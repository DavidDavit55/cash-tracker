import { insurancePolicies as mockInsurancePolicies, buildWhatsAppLink } from '../mockData';
import { useMaslakaData } from '../hooks/useMaslakaData';
import { useIsPreviewRoute } from '../hooks/useIsPreviewRoute';
import PendingDataScreen from '../components/PendingDataScreen';
import ProductCard, { fmt } from '../components/ProductCard';
import CoverageGapWidget from '../components/dashboard/CoverageGapWidget';

export default function Protection() {
  const { pensionOverride, insuranceOverride, harBituachOverride, loading: maslakaLoading } = useMaslakaData() || {};
  const isPreview = useIsPreviewRoute();
  const hasRealData = Boolean(pensionOverride) || Boolean(insuranceOverride) || Boolean(harBituachOverride);

  if (maslakaLoading) return <div className="loading full">טוען...</div>;
  if (!hasRealData && !isPreview && !import.meta.env.DEV) {
    return <PendingDataScreen />;
  }

  const insurancePolicies = (insuranceOverride || harBituachOverride)
    ? [...(insuranceOverride || []), ...(harBituachOverride || [])]
    : mockInsurancePolicies;
  const monthlyTotal = insurancePolicies.reduce((s, p) => s + (p.monthlyPremium || 0), 0);
  const hasHealthInsurance = insurancePolicies.some(p => p.type === 'health');

  return (
    <div className="page">
      <div className="page-header"><h2>ההגנות שלי</h2></div>

      <div className="summary-card" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
        <div className="summary-amount" style={{ fontSize: '1.8rem' }}>{fmt(monthlyTotal)}</div>
        <div className="summary-label">פרמיה חודשית כוללת</div>
      </div>

      {!hasHealthInsurance && <CoverageGapWidget missingLabel="ביטוח בריאות פרטי" />}

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
    </div>
  );
}
