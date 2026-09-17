import { useState, useEffect } from 'react';
import { pensionFunds as mockPensionFunds, buildWhatsAppLink, userProfile } from '../mockData';
import { fetchRealFundData } from '../lib/pensionNetApi';
import { fetchCategoryAverage, fetchOwnLTM } from '../lib/categoryAverage';
import { useMaslakaData } from '../hooks/useMaslakaData';
import { getAgencyPensionFee, getAgencyGemelFee } from '../data/agencyFeeAgreements';
import { useIsPreviewRoute } from '../hooks/useIsPreviewRoute';
import PendingDataScreen from '../components/PendingDataScreen';
import ProductCard, { fmt } from '../components/ProductCard';
import { statusWarning } from '../lib/statusWarning';
import { dedupById } from '../lib/dedupById';

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
  const [categoryAvg, setCategoryAvg] = useState(null);
  const [ownLtm, setOwnLtm] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchRealFundData(f.provider, f.type, f.investmentTrack, f.name, f.investmentTrackCode)
      .then(data => { if (!cancelled) { setReal(data); setRealStatus(data ? 'ok' : 'none'); } })
      .catch(() => { if (!cancelled) setRealStatus('none'); });
    return () => { cancelled = true; };
  }, [f.provider, f.type, f.investmentTrack, f.name, f.investmentTrackCode]);

  // השוואה מול השוק (12 חודשים) - רק לפנסיה עם התאמה מדויקת, כדי לא להשוות מסלול שגוי בטעות.
  useEffect(() => {
    if (!real?.exactMatch || f.type !== 'pension') return;
    let cancelled = false;
    Promise.all([fetchCategoryAverage(real.fundName), fetchOwnLTM(real.fundId)])
      .then(([avg, own]) => { if (!cancelled) { setCategoryAvg(avg); setOwnLtm(own); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [real?.exactMatch, real?.fundName, real?.fundId, f.type]);

  const stockExposure = real?.stockExposurePercent ?? f.stockExposure;
  const showTrackAdvisory = f.isDefaultTrack && userProfile.age < YOUNG_AGE_THRESHOLD;

  const agencyDeal = getBestDealForFund(f);
  const currentFee = f.feeFromAccumulation ?? Infinity;
  const showAgencyDeal = agencyDeal && agencyDeal.feeFromAccumulation < currentFee;

  const { warning, warningText } = statusWarning(f);

  return (
    <ProductCard
      name={f.name}
      subtitle={f.provider}
      amount={fmt(f.balance)}
      borderBottom={borderBottom}
      warning={warning}
      warningText={warningText}
      details={
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
            {f.feeFromDeposit != null && <div>דמי ניהול מהפקדה: <b style={{ color: 'var(--text)' }}>{f.feeFromDeposit}%</b></div>}
            {f.feeFromAccumulation != null && <div>דמי ניהול מצבירה: <b style={{ color: 'var(--text)' }}>{f.feeFromAccumulation}%</b></div>}
            <div>מסלול השקעה: <b style={{ color: 'var(--text)' }}>{f.investmentTrack}</b></div>
            {stockExposure != null && <div>חשיפה למניות: <b style={{ color: 'var(--text)' }}>{stockExposure}%</b></div>}
            {real && (
              <>
                <div>תשואה 3 שנים (שוק): <b style={{ color: 'var(--text)' }}>{real.yieldTrailing3Yrs}%</b></div>
                <div>תשואה 5 שנים (שוק): <b style={{ color: 'var(--text)' }}>{real.yieldTrailing5Yrs}%</b></div>
              </>
            )}
            {!real && <div>תשואה 12 חודשים: <b style={{ color: 'var(--text)' }}>{f.return12m}%</b></div>}
          </div>
          {categoryAvg && ownLtm != null && (
            <div style={{ background: ownLtm >= categoryAvg.average ? '#ecfdf5' : '#fef2f2', color: ownLtm >= categoryAvg.average ? '#065f46' : '#991b1b', borderRadius: '8px', padding: '8px 10px', fontSize: '0.78rem', marginTop: '8px' }}>
              📊 תשואת המסלול שלך ב-12 החודשים האחרונים: <b>{ownLtm.toFixed(2)}%</b>, לעומת ממוצע השוק באותו סוג מסלול ({categoryAvg.byCompany.length} חברות): <b>{categoryAvg.average.toFixed(2)}%</b>
              {ownLtm >= categoryAvg.average ? ' — מעל הממוצע 🎉' : ' — מתחת לממוצע'}
            </div>
          )}
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

function ManagersFundCard({ p, borderBottom }) {
  const [real, setReal] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchRealFundData(p.provider, 'managers', p.investmentTrack, p.name, p.investmentTrackCode)
      .then(data => { if (!cancelled) setReal(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [p.provider, p.investmentTrack, p.name, p.investmentTrackCode]);

  const stockExposure = real?.stockExposurePercent;

  return (
    <ProductCard
      name={p.name}
      subtitle={`${p.provider}${p.monthlyPremium != null ? ` • פרמיה ${fmt(p.monthlyPremium)}/חודש` : ''}`}
      amount={p.balance != null ? fmt(p.balance) : 'צבירה לא ידועה'}
      borderBottom={borderBottom}
      warning={statusWarning(p).warning}
      warningText={statusWarning(p).warningText}
      badge={p.pledgedTo ? 'משועבד' : null}
      details={
        <div>
          <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingRight: '18px', margin: 0, lineHeight: 1.8 }}>
            {p.coverageItems.map((c, j) => <li key={j}>{c}</li>)}
          </ul>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.8, marginTop: '6px' }}>
            {p.feeFromDeposit != null && <div>דמי ניהול מהפקדה: <b style={{ color: 'var(--text)' }}>{p.feeFromDeposit}%</b></div>}
            {p.feeFromAccumulation != null && <div>דמי ניהול מצבירה: <b style={{ color: 'var(--text)' }}>{p.feeFromAccumulation}%</b></div>}
            {stockExposure != null && <div>חשיפה למניות: <b style={{ color: 'var(--text)' }}>{stockExposure}%</b></div>}
            {real && (
              <>
                <div>תשואה 3 שנים (שוק): <b style={{ color: 'var(--text)' }}>{real.yieldTrailing3Yrs}%</b></div>
                <div>תשואה 5 שנים (שוק): <b style={{ color: 'var(--text)' }}>{real.yieldTrailing5Yrs}%</b></div>
              </>
            )}
            {!real && p.return12m != null && <div>תשואה 12 חודשים: <b style={{ color: 'var(--text)' }}>{p.return12m}%</b></div>}
          </div>
        </div>
      }
      ctaLabel="השווה עבורי"
      ctaHref={buildWhatsAppLink(p.name, p.provider)}
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

  // 4 קטגוריות נפרדות במקום רשימה שטוחה אחת: פנסיה, קרנות השתלמות, גמל (כל השאר מ-type='gemel'),
  // וביטוח מנהלים (כבר קיים כקבוצה נפרדת למטה).
  const pensionOnly = pensionFunds.filter(f => f.type === 'pension');
  const studyFunds = pensionFunds.filter(f => f.type === 'gemel' && f.productType === 'קרן השתלמות');
  const gemelOnly = pensionFunds.filter(f => f.type === 'gemel' && f.productType !== 'קרן השתלמות');
  const FUND_GROUPS = [
    { label: 'פנסיה', items: pensionOnly },
    { label: 'גמל', items: gemelOnly },
    { label: 'קרנות השתלמות', items: studyFunds },
  ];

  // ביטוח מנהלים הוא בפועל מוצר חיסכון (יש לו צבירה) - מוצג כאן, לא בהגנות.
  // לא תמיד יש לנו את הצבירה שלו (למשל דוח הר ביטוח לא כולל אותה) - נספר רק מה שידוע.
  const managersProducts = dedupById([...(insuranceOverride || []), ...(harBituachOverride || [])]).filter(p => p.type === 'managers');
  const total = pensionFunds.reduce((s, p) => s + p.balance, 0)
    + managersProducts.reduce((s, p) => s + (p.balance || 0), 0);

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

      {FUND_GROUPS.map(({ label, items }) => items.length > 0 && (
        <div className="chart-card" style={{ padding: '14px 0' }} key={label}>
          <h3 style={{ padding: '0 16px 10px' }}>{label}</h3>
          {items.map((f, i) => (
            <PensionFundCard key={f.id} f={f} borderBottom={i < items.length - 1} />
          ))}
        </div>
      ))}

      {managersProducts.length > 0 && (
        <div className="chart-card" style={{ padding: '14px 0' }}>
          <h3 style={{ padding: '0 16px 10px' }}>ביטוח מנהלים (מוצר חיסכון)</h3>
          {managersProducts.map((p, i) => (
            <ManagersFundCard key={p.id} p={p} borderBottom={i < managersProducts.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}
