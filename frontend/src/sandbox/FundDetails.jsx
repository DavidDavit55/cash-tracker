import { displayProductNumber } from './productIdentity';
import ProductStatus from './ProductStatus';
import FeeComparison from './FeeComparison';
import { useEffect, useState } from 'react';
import { Sparkles, ExternalLink, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { fetchRealFundData } from '../lib/pensionNetApi';
import { fetchCategoryAverage, fetchOwnLTM } from './marketComparison';

import { buildCalendlyLink } from '../mockData';
import { percent, recommendationFor } from './model';
import { DepositsPanel, DisabilityPanel, SurvivorsPanel } from './ProductPanels';

export default function FundDetails({ fund, snapshot }) {
  const [market, setMarket] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [status, setStatus] = useState('loading');
  const [returnMonths, setReturnMonths] = useState(12);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const recommendation = recommendationFor(fund, snapshot);
  useEffect(() => {
    let active = true;
    const bounded = promise => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('הטעינה נמשכת זמן רב מדי. אפשר לנסות שוב.')), 30000);
      promise.then(value => { clearTimeout(timer); resolve(value); }, reason => { clearTimeout(timer); reject(reason); });
    });
    async function load() {
      // Defer initial updates and ignore results from a closed/replaced product.
      await Promise.resolve();
      if (!active) return;
      setStatus('loading'); setError(''); setMarket(null); setComparison(null);
      try {
        const type = fund.type === 'study' ? 'gemel' : fund.type;
        const data = await bounded(fetchRealFundData(fund.provider, type, fund.investmentTrack, fund.name, fund.investmentTrackCode));
        if (!active) return;
        setMarket(data);
        if (!data) { setError('לא נמצאו נתוני מסלול במאגר הממשלתי. נתוני התיק שלך נשארים ללא שינוי.'); return; }
        if (!data.exactMatch) { setError('נמצאה התאמה לפי שם בלבד. לא נציג אותה כתשואת המסלול שלך; נדרש קוד מסלול מדויק.'); return; }
        if (!['pension', 'gemel'].includes(type)) return;
        setStatus('comparing');
        const [group, own] = await bounded(Promise.all([
          fetchCategoryAverage(data.fundName, type, fund.productType, data.reportPeriod, returnMonths),
          fetchOwnLTM(data.fundId, type, data.reportPeriod, returnMonths),
        ]));
        if (!active) return;
        if (!group || own == null) { setError(`אין מספיק נתונים מלאים להשוואה של ${returnMonths / 12} שנים במסלול הזה.`); return; }
        setComparison({ ...group, own });
      } catch (e) {
        if (active) setError(e.message === 'Failed to fetch' ? 'המאגר הממשלתי אינו זמין כרגע. אפשר לנסות שוב.' : e.message || 'לא ניתן לטעון נתוני מסלול כרגע.');
      } finally { if (active) setStatus(''); }
    }
    load();
    return () => { active = false; };
  }, [fund.provider, fund.type, fund.investmentTrack, fund.name, fund.investmentTrackCode, fund.productType, attempt, returnMonths]);
  return <><div className="detail-meta"><span>חברה מנהלת<b>{fund.provider || 'לא התקבל'}</b></span><span>מספר מוצר<b>{displayProductNumber(fund.id)}</b></span><span>מקור<b>{snapshot.source === 'demo' ? 'תיק הדגמה' : snapshot.source === 'file' ? 'קובץ בפענוח מקומי' : 'API קיים · קריאה בלבד'}</b></span><span>עודכן לאחרונה<b>{fund.detailData?.updatedAt || 'לא התקבל'}</b></span><span>פתיחת קופה<b>{fund.detailData?.openedAt || 'לא התקבל'}</b></span><ProductStatus product={fund} /></div><div className="sb-fund-grid">
    <div><DepositsPanel fund={fund} demo={snapshot.source === 'demo'} />{fund.type === 'pension' && <FeeComparison fund={fund} snapshot={snapshot} />}
    {!['sandbox', 'production'].includes(snapshot.source) && <section className="blue-advice sb-product-advice"><h3>המלצות NETWORTH <Sparkles size={20} /></h3><p>{recommendation ? 'נמצאה נקודה לבדיקה בדמי הניהול ביחס לבסיס ההשוואה שלנו. נבדוק יחד אם קיימת חלופה מתאימה.' : 'כדאי לבדוק שפרטי ההפקדות והכיסויים בתיק מעודכנים ומתאימים לצרכים שלך.'}</p>{snapshot.source === 'demo' && <small>תיק הדגמה · נתונים להמחשה בלבד</small>}<a className="sb-white-link" href={buildCalendlyLink()} target="_blank" rel="noreferrer">לתיאום פגישה <ExternalLink size={14} /></a></section>}</div>
    <div><div className="stat-grid">{[['דמי ניהול מצבירה', percent(fund.feeFromAccumulation)], ['דמי ניהול מהפקדה', percent(fund.feeFromDeposit)], ['מסלול השקעה', fund.investmentTrack || 'לא התקבל'], ['מעסיק נוכחי', fund.detailData?.currentEmployers?.join(' · ') || 'לא דווח מעסיק נוכחי'], ['חשיפה למניות', market?.exactMatch ? percent(market.stockExposurePercent) : percent(fund.stockExposure)]].map(([label, value]) => <section className="panel stat" key={label}><h3>{label}</h3><p>{value}</p></section>)}</div>{fund.type === 'pension' && <section className="panel sb-insurance-coverage"><h3>כיסוי ביטוחי</h3><div className="sb-insurance-coverage-grid"><DisabilityPanel fund={fund} /><SurvivorsPanel fund={fund} /></div></section>}{fund.coverageItems?.length > 0 && <section className="panel coverage"><h3>כיסויים במוצר</h3><ul>{fund.coverageItems.map((item, i) => <li key={i}>{item}</li>)}</ul></section>}</div>
    <div><section className="panel sb-market-panel"><div className="sb-market-heading"><h3><TrendingUp size={18} />איך המסלול שלך ביחס לממוצע?</h3><select aria-label="תקופת השוואת תשואות" value={returnMonths} onChange={event => { setComparison(null); setError(''); setStatus('loading'); setReturnMonths(Number(event.target.value)); }}><option value={12}>שנה</option><option value={36}>3 שנים</option><option value={60}>5 שנים</option></select></div><p>תשואה מצטברת ב־{returnMonths} חודשים</p>{status && <p role="status" className="sb-import-progress">{status === 'loading' ? 'טוען נתוני מסלול אוטומטית…' : `טוען השוואת תשואת ${returnMonths} חודשים…`}</p>}{market?.exactMatch && <div className="sb-market-verified"><strong>{market.fundName}</strong></div>}{error && !status && <button className="outline" onClick={() => setAttempt(value => value + 1)}>ניסיון חוזר</button>}{error && <p role="status" className="sb-inline-message">{error}</p>}
    {comparison && <><div className="sb-return-insight"><strong>{Math.abs(comparison.own - comparison.average) < 0.005 ? 'התשואה תואמת לממוצע הקבוצה' : `התשואה ${comparison.own < comparison.average ? 'נמוכה' : 'גבוהה'} מהממוצע ב־${Math.abs(comparison.own - comparison.average).toFixed(2)} נקודות אחוז`}</strong><p>המסלול שלך: {comparison.own.toFixed(2)}% · ממוצע הקבוצה: {comparison.average.toFixed(2)}%</p><small>{comparison.own < comparison.average - 0.005 ? 'כדאי לבחון את הביצועים גם לאורך זמן, לצד רמת הסיכון ודמי הניהול. פער בתקופה אחת לבדו אינו סיבה להחליף מסלול.' : 'זו השוואת ביצועי עבר לאותה תקופה, ואינה מבטיחה תשואה בעתיד.'}</small></div><div className="sb-market-chart" dir="ltr"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: 'המסלול שלך', value: comparison.own }, { name: 'ממוצע הקבוצה', value: comparison.average }]}><CartesianGrid vertical={false} stroke="#eee" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tickFormatter={n => `${n}%`} width={40} /><Tooltip formatter={n => [`${n.toFixed(2)}%`, `תשואה מצטברת · ${returnMonths} חודשים`]} /><Bar dataKey="value" fill="#246653" radius={[7, 7, 0, 0]} barSize={40} /></BarChart></ResponsiveContainer></div><small>ממוצע פשוט של {comparison.byCompany.length} חברות בקטגוריה, ל־{returnMonths} חודשים עד {String(comparison.endPeriod).slice(4)}/{String(comparison.endPeriod).slice(0, 4)}.</small></>}
    </section></div>
  </div></>;
}
