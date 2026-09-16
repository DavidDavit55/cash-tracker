import { useState, useEffect } from 'react';
import { pensionFunds as mockPensionFunds, buildWhatsAppLink, userProfile } from '../mockData';
import { fetchRealFundData } from '../lib/pensionNetApi';
import { useMaslakaData } from '../hooks/useMaslakaData';
import { getAgencyPensionFee, getAgencyGemelFee } from '../data/agencyFeeAgreements';
import { useIsPreviewRoute } from '../hooks/useIsPreviewRoute';
import PendingDataScreen from '../components/PendingDataScreen';
import ProductCard, { fmt } from '../components/ProductCard';

const YOUNG_AGE_THRESHOLD = 50; // ponytail: כלל אצבע פשוט, לא נוסחה פיננסית מלאה

// ponytail: "חיסכון לכל ילד" הוא חשבון ממשלתי אחיד - אין עליו הסכם סוכנות ואין מה להשוות מולו.
const NO_DEAL_PRODUCT_TYPES = new Set(['חיסכון לכל ילד']);

function getBestDealForFund(f) {
  if (NO_DEAL_PRODUCT_TYPES.has(f.productType)) return null;
  return f.type === 'pension'
    ? getAgencyPensionFee(f.provider, { salary: userProfile.salary, balance: f.balance })
    : getAgencyGemelFee(f.provider, f.balance, f.type === 'gemel');
}

function PensionFundCard({ f, borderBottom }) {
  const [real, setReal] = useState(null);
  const [realStatus, setRealStatus] = useState('loading'); // loading | ok | none

  useEffect(() => {
    let cancelled = false;
    fetchRealFundData(f.provider, f.type)
      .then(data => { if (!cancelled) { setReal(data); setRealStatus(data ? 'ok' : 'none'); } })
      .catch(() => { if (!cancelled) setRealStatus('none'); });
    return () => { cancelled = true; };
  }, [f.provider, f.type]);

  const stockExposure = real?.stockExposurePercent ?? f.stockExposure;
  const showTrackAdvisory = f.isDefaultTrack && userProfile.age < YOUNG_AGE_THRESHOLD;

  const agencyDeal = getBestDealForFund(f);
  const currentFee = f.feeFromAccumulation ?? Infinity;
  const showAgencyDeal = agencyDeal && agencyDeal.feeFromAccumulation < currentFee;

  return (
    <ProductCard
      name={f.name}
      subtitle={f.provider}
      amount={fmt(f.balance)}
      borderBottom={borderBottom}
      details={
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
            <div>דמי ניהול מהפקדה: <b style={{ color: 'var(--text)' }}>{f.feeFromDeposit}%</b></div>
            <div>דמי ניהול מצבירה: <b style={{ color: 'var(--text)' }}>{f.feeFromAccumulation}%</b></div>
            <div>מסלול השקעה: <b style={{ color: 'var(--text)' }}>{f.investmentTrack}</b></div>
            {real && (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '5px 8px', margin: '4px 0', fontSize: '0.72rem', color: '#065f46' }}>
                🟢 נתוני שוק אמיתיים מבוססים על: <b>{real.fundName}</b> (דוח {String(real.reportPeriod).slice(0,4)}-{String(real.reportPeriod).slice(4)}) — התאמה לפי שם החברה בלבד, ייתכן שאינה הקרן המדויקת של הלקוח.
              </div>
            )}
            {stockExposure != null && <div>חשיפה למניות: <b style={{ color: 'var(--text)' }}>{stockExposure}%</b></div>}
            {real && (
              <>
                <div>תשואה 3 שנים (שוק): <b style={{ color: 'var(--text)' }}>{real.yieldTrailing3Yrs}%</b></div>
                <div>תשואה 5 שנים (שוק): <b style={{ color: 'var(--text)' }}>{real.yieldTrailing5Yrs}%</b></div>
              </>
            )}
            {!real && <div>תשואה 12 חודשים: <b style={{ color: 'var(--text)' }}>{f.return12m}%</b></div>}
          </div>
          {showTrackAdvisory && (
            <div style={{ background: '#fffbeb', color: '#92400e', borderRadius: '8px', padding: '8px 10px', fontSize: '0.78rem', marginTop: '8px' }}>
              בגיל {userProfile.age} אתה במסלול ברירת מחדל תלוי-גיל עם {stockExposure}% חשיפה למניות — בגילך אפשר לרוב להעז יותר. כדאי לבדוק מסלול עם חשיפה גבוהה יותר.
            </div>
          )}
          {showAgencyDeal && (
            <div style={{ background: '#ecfdf5', color: '#065f46', borderRadius: '8px', padding: '8px 10px', fontSize: '0.78rem', marginTop: '8px' }}>
              💰 יש לי הסכם מול {agencyDeal.company}! דמי הניהול שאני יכול להשיג לך: <b>{agencyDeal.feeFromAccumulation}% מצבירה</b>
              {agencyDeal.feeFromDeposit != null && <> / <b>{agencyDeal.feeFromDeposit}% מהפקדה</b></>}
              {' '}(אתה משלם היום {currentFee}%).
            </div>
          )}
        </div>
      }
      ctaLabel="השווה עבורי"
      ctaHref={buildWhatsAppLink(f.name, `${f.provider}, ${fmt(f.balance)}`)}
    />
  );
}

export default function Pension() {
  const { pensionOverride, insuranceOverride, harBituachOverride, clientInfo, loading: maslakaLoading } = useMaslakaData() || {};
  const isPreview = useIsPreviewRoute();
  const hasRealData = Boolean(pensionOverride) || Boolean(insuranceOverride) || Boolean(harBituachOverride);

  if (maslakaLoading) return <div className="loading full">טוען...</div>;
  if (!hasRealData && !isPreview && !import.meta.env.DEV) {
    return <PendingDataScreen />;
  }

  const pensionFunds = pensionOverride || mockPensionFunds;
  const total = pensionFunds.reduce((s, p) => s + p.balance, 0);

  // ביטוח מנהלים הוא בפועל מוצר חיסכון (יש לו צבירה) - מוצג כאן, לא בהגנות.
  const managersProducts = [...(insuranceOverride || []), ...(harBituachOverride || [])].filter(p => p.type === 'managers');

  const weightedFee = pensionFunds.reduce((s, p) => s + (p.feeFromAccumulation || 0) * p.balance, 0) / total;
  const weightedBestFee = pensionFunds.reduce((s, p) => {
    const deal = getBestDealForFund(p);
    return s + (deal?.feeFromAccumulation ?? p.feeFromAccumulation ?? 0) * p.balance;
  }, 0) / total;
  const feeDiff = weightedFee - weightedBestFee;

  return (
    <div className="page">
      <div className="page-header">
        <h2>גמל ופנסיה</h2>
        {clientInfo && (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            לקוח: {clientInfo.first} {clientInfo.last}
          </span>
        )}
      </div>

      <div className="summary-card">
        <div className="summary-amount" style={{ fontSize: '1.8rem' }}>{fmt(total)}</div>
        <div className="summary-label">סך הכל צבור</div>
      </div>

      {feeDiff > 0 && (
        <div className="chart-card">
          <h3>דמי ניהול</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
            <span>אתה משלם בממוצע</span>
            <b style={{ color: '#ef4444' }}>{weightedFee.toFixed(2)}%</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '10px', color: 'var(--text-muted)' }}>
            <span>מה שאני יכול להשיג לך</span>
            <span>{weightedBestFee.toFixed(2)}%</span>
          </div>
          <div style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: '8px', padding: '8px 10px', fontSize: '0.8rem' }}>
            אתה משלם {feeDiff.toFixed(2)}% יותר ממה שאני יכול להשיג לך — פוטנציאל חיסכון משמעותי לאורך שנים.
          </div>
        </div>
      )}

      <div className="chart-card" style={{ padding: '14px 0' }}>
        {pensionFunds.map((f, i) => (
          <PensionFundCard key={f.id} f={f} borderBottom={i < pensionFunds.length - 1} />
        ))}
      </div>

      {managersProducts.length > 0 && (
        <div className="chart-card" style={{ padding: '14px 0' }}>
          <h3 style={{ padding: '0 16px 10px' }}>ביטוח מנהלים (מוצר חיסכון)</h3>
          {managersProducts.map((p, i) => (
            <ProductCard
              key={p.id}
              name={p.name}
              subtitle={`${p.provider}${p.coverage ? ` • כיסוי ${fmt(p.coverage)}` : ''}`}
              amount={p.monthlyPremium != null ? `${fmt(p.monthlyPremium)}/חודש` : 'לא ידוע'}
              borderBottom={i < managersProducts.length - 1}
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
