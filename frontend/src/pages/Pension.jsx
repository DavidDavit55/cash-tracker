import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { pensionFunds as mockPensionFunds, buildCalendlyLink, CTA_LABEL, userProfile } from '../mockData';
import { fetchRealFundData } from '../lib/pensionNetApi';
import { fetchCategoryAverage, fetchOwnLTM } from '../lib/categoryAverage';
import { useAuth } from '../hooks/useAuth';
import { useMaslakaData } from '../hooks/useMaslakaData';
import { getAgencyPensionFee, getAgencyGemelFee } from '../data/agencyFeeAgreements';
import { monthsToRetirement, projectRetirement } from '../lib/pensionProjection';
import { useIsPreviewRoute } from '../hooks/useIsPreviewRoute';
import PendingDataScreen from '../components/PendingDataScreen';
import ProductCard, { fmt } from '../components/ProductCard';
import { statusWarning } from '../lib/statusWarning';
import { dedupById } from '../lib/dedupById';

const YOUNG_AGE_THRESHOLD = 50; // ponytail: כלל אצבע פשוט, לא נוסחה פיננסית מלאה

// גיל אמיתי של הלקוח (מ-clientInfo.birth), לא userProfile.age שהוא מוקאפ קבוע - תפס אמיתי:
// ההמלצה "בגיל 32..." הוצגה ללקוח בן 41 כי userProfile.age לא היה קשור אליו בכלל.
function ageFromBirth(birthDateStr) {
  const m = (birthDateStr || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, day, month, year] = m;
  const birth = new Date(Number(year), Number(month) - 1, Number(day));
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear = now.getMonth() > birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age--;
  return age;
}

// שם קריא לקטגוריה שמחזיר classifyTrack (categoryAverage.js) - כדי להציג "במסלול X" במקום
// "באותו סוג מסלול" הגנרי.
function categoryLabel(category) {
  const ageMatch = (category || '').match(/^age_(\d+)_under$/);
  if (ageMatch) return `מסלול לבני ${ageMatch[1]} ומטה`;
  if (category === 'equity') return 'מסלול מניות';
  if (category === 'sp500') return 'מסלול עוקב S&P 500';
  if (category === 'halachic') return 'מסלול הלכתי';
  return 'אותו סוג מסלול';
}

// ponytail: "חיסכון לכל ילד" הוא חשבון ממשלתי אחיד - אין עליו הסכם סוכנות ואין מה להשוות מולו.
const NO_DEAL_PRODUCT_TYPES = new Set(['חיסכון לכל ילד']);

function getBestDealForFund(f) {
  if (NO_DEAL_PRODUCT_TYPES.has(f.productType)) return null;
  return f.type === 'pension'
    ? getAgencyPensionFee(f.provider, { salary: userProfile.salary, balance: f.balance })
    : getAgencyGemelFee(f.provider, f.balance, f.type === 'gemel');
}

function PensionFundCard({ f, borderBottom, clientName, clientEmail, clientBirth }) {
  const [real, setReal] = useState(null);
  const [realStatus, setRealStatus] = useState('loading'); // loading | ok | none
  const [categoryAvg, setCategoryAvg] = useState(null);
  const [ownLtm, setOwnLtm] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchRealFundData(f.provider, f.type, f.investmentTrack, f.name, f.investmentTrackCode)
      .then(data => { if (!cancelled) { setReal(data); setRealStatus(data ? 'ok' : 'none'); } })
      .catch(() => { if (!cancelled) setRealStatus('none'); });
    return () => { cancelled = true; };
  }, [f.provider, f.type, f.investmentTrack, f.name, f.investmentTrackCode]);

  const canCompare = Boolean(real?.exactMatch) && (f.type === 'pension' || f.type === 'gemel');

  // בלחיצה בלבד, לא אוטומטי - כדי שהלקוח לא יחכה לטעינה של דבר שלא ביקש לראות.
  function handleToggleCompare() {
    const next = !compareOpen;
    setCompareOpen(next);
    if (next && !categoryAvg && !compareLoading) {
      setCompareLoading(true);
      Promise.all([fetchCategoryAverage(real.fundName, f.type, f.productType), fetchOwnLTM(real.fundId, f.type)])
        .then(([avg, own]) => { setCategoryAvg(avg); setOwnLtm(own); })
        .catch(() => {})
        .finally(() => setCompareLoading(false));
    }
  }

  const stockExposure = real?.stockExposurePercent ?? f.stockExposure;
  const age = ageFromBirth(clientBirth) ?? userProfile.age;
  const showTrackAdvisory = f.isDefaultTrack && age < YOUNG_AGE_THRESHOLD;

  const agencyDeal = getBestDealForFund(f);
  const currentFee = f.feeFromAccumulation ?? Infinity;
  const showAgencyDeal = agencyDeal && agencyDeal.feeFromAccumulation < currentFee;
  // אם אפשר להשוות מול השוק - קודם ההשוואה, אחר כך ההמלצות (המלצה בלי הקשר "איפה אתה עומד"
  // קודם פחות משכנעת). אם אי אפשר להשוות (אין התאמה מדויקת), אין למה לחכות - מציגים ישר.
  const revealExtras = !canCompare || compareOpen;

  const months = f.type === 'pension' ? monthsToRetirement(clientBirth) : null;
  const canProjectFeeSavings = showAgencyDeal && f.type === 'pension' && months != null && f.monthlyDeposit != null;
  let feeSavings = null;
  if (canProjectFeeSavings) {
    const base = { balance: f.balance, monthlyDeposit: f.monthlyDeposit, months };
    const withCurrentFees = projectRetirement({ ...base, feeFromDepositPct: f.feeFromDeposit, feeFromAccumulationPct: f.feeFromAccumulation });
    const withAgencyFees = projectRetirement({ ...base, feeFromDepositPct: agencyDeal.feeFromDeposit, feeFromAccumulationPct: agencyDeal.feeFromAccumulation });
    feeSavings = Math.round(withAgencyFees - withCurrentFees);
  }

  const { warning, warningText } = statusWarning(f);

  const StatBox = ({ label, value }) => (
    <div style={{ border: '1px solid #eee7d6', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
      <div style={{ fontSize: '0.7rem', color: '#8a8067', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a' }}>{value}</div>
    </div>
  );

  return (
    <ProductCard
      sheet
      name={f.name}
      subtitle={f.provider}
      amount={fmt(f.balance)}
      borderBottom={borderBottom}
      warning={warning}
      warningText={warningText}
      details={
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            {f.feeFromDeposit != null && <StatBox label="דמי ניהול מהפקדה" value={`${f.feeFromDeposit}%`} />}
            {f.feeFromAccumulation != null && <StatBox label="דמי ניהול מצבירה" value={`${f.feeFromAccumulation}%`} />}
            <StatBox label="מסלול השקעה" value={f.investmentTrack} />
            {stockExposure != null && <StatBox label="חשיפה למניות" value={`${stockExposure}%`} />}
          </div>
          {!real && f.return12m != null && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>תשואה 12 חודשים: <b style={{ color: 'var(--text)' }}>{f.return12m}%</b></div>
          )}

          {canCompare && !compareOpen && (
            <button
              onClick={handleToggleCompare}
              style={{ background: '#f5f3ff', color: '#5b21b6', border: 'none', borderRadius: '10px', padding: '12px 10px', fontSize: '0.85rem', marginBottom: '14px', width: '100%', textAlign: 'center', cursor: 'pointer', fontWeight: 600 }}
            >
              🔍 רוצה להבין איפה אתה ביחס לאחרים?
            </button>
          )}
          {canCompare && compareOpen && compareLoading && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>טוען השוואה...</div>
          )}
          {canCompare && compareOpen && categoryAvg && ownLtm != null && (
            <div style={{ border: '1px solid #eee7d6', borderRadius: '14px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '10px' }}>
                תשואה 12 חודשים — אתה מול ממוצע השוק ב{categoryLabel(categoryAvg.category)}
              </div>
              <ResponsiveContainer width="100%" height={140} dir="ltr">
                <BarChart data={[{ name: 'אתה', value: +ownLtm.toFixed(2) }, { name: 'ממוצע שוק', value: +categoryAvg.average.toFixed(2) }]} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={v => `${v}%`} />
                  <Bar dataKey="value" radius={[6, 6, 6, 6]} barSize={22}>
                    <Cell fill={ownLtm >= categoryAvg.average ? '#00573F' : '#dc4c3f'} />
                    <Cell fill="#C9A227" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: '0.78rem', color: ownLtm >= categoryAvg.average ? '#065f46' : '#991b1b', marginTop: '4px', textAlign: 'center' }}>
                {ownLtm >= categoryAvg.average ? 'מעל הממוצע 🎉' : 'מתחת לממוצע'} ({categoryAvg.byCompany.length} חברות שנבדקו)
              </div>
            </div>
          )}
          {showTrackAdvisory && revealExtras && (
            <div style={{ background: '#fffbeb', color: '#92400e', borderRadius: '12px', padding: '12px', fontSize: '0.8rem', marginBottom: '14px' }}>
              בגיל {age} אתה במסלול ברירת מחדל תלוי-גיל עם {stockExposure}% חשיפה למניות — בגילך אפשר לרוב להעז יותר. כדאי לבדוק מסלול עם חשיפה גבוהה יותר.
            </div>
          )}
          {showAgencyDeal && revealExtras && (
            <div style={{ background: 'linear-gradient(135deg, #00573F, #003d2b)', color: '#fff', borderRadius: '14px', padding: '16px', fontSize: '0.85rem', lineHeight: 1.7 }}>
              <div style={{ color: '#C9A227', fontWeight: 700, fontSize: '0.78rem', marginBottom: '6px' }}>💡 המלצה</div>
              {feeSavings != null && feeSavings > 0 ? (
                <div>דמי הניהול שאתה משלם היום גבוהים ביחס להפקדה ולצבירה שלך. עד הפרישה אפשר לחסוך לפחות <b style={{ color: '#e8c765' }}>{fmt(feeSavings)}</b> יותר.</div>
              ) : (
                <div>יש לי הסכם מול {agencyDeal.company} שיכול להוזיל לך את דמי הניהול.</div>
              )}
            </div>
          )}
        </div>
      }
      ctaLabel={revealExtras ? (feeSavings != null && feeSavings > 0 ? `רוצה לשמוע עוד הצעות? ${CTA_LABEL}` : CTA_LABEL) : null}
      ctaHref={buildCalendlyLink(clientName, clientEmail)}
    />
  );
}

function ManagersFundCard({ p, borderBottom, clientName, clientEmail }) {
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
            {!real && p.return12m != null && <div>תשואה 12 חודשים: <b style={{ color: 'var(--text)' }}>{p.return12m}%</b></div>}
          </div>
        </div>
      }
      ctaLabel={CTA_LABEL}
      ctaHref={buildCalendlyLink(clientName, clientEmail)}
    />
  );
}

export default function Pension() {
  const { pensionOverride, insuranceOverride, harBituachOverride, clientInfo, loading: maslakaLoading } = useMaslakaData() || {};
  const { user } = useAuth();
  const isSandbox = useLocation().pathname.startsWith('/admin/parser-test');
  const isPreview = useIsPreviewRoute();
  const hasRealData = Boolean(pensionOverride) || Boolean(insuranceOverride) || Boolean(harBituachOverride);

  if (maslakaLoading) return <div className="app-loading full" role="status">טוען...</div>;
  if (!hasRealData && !isPreview && !import.meta.env.DEV) {
    return <PendingDataScreen />;
  }

  const pensionFunds = pensionOverride || mockPensionFunds;
  const clientName = clientInfo ? `${clientInfo.first || ''} ${clientInfo.last || ''}`.trim() : undefined;
  // המייל של המשתמש המחובר הוא באמת מייל הלקוח רק כשזה הוא עצמו מציג את הנתונים שלו -
  // בסנדבוקס (admin/parser-test) המשתמש המחובר הוא דוד, לא הלקוח שבתצוגה.
  const clientEmail = isSandbox ? undefined : user?.email;

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
            <PensionFundCard key={f.id} f={f} borderBottom={i < items.length - 1} clientName={clientName} clientEmail={clientEmail} clientBirth={clientInfo?.birth} />
          ))}
        </div>
      ))}

      {managersProducts.length > 0 && (
        <div className="chart-card" style={{ padding: '14px 0' }}>
          <h3 style={{ padding: '0 16px 10px' }}>ביטוח מנהלים (מוצר חיסכון)</h3>
          {managersProducts.map((p, i) => (
            <ManagersFundCard key={p.id} p={p} borderBottom={i < managersProducts.length - 1} clientName={clientName} clientEmail={clientEmail} />
          ))}
        </div>
      )}
    </div>
  );
}
