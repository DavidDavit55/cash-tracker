import { dedupById } from './productIdentity.js';
import { isAgeTrack, consolidationReview } from './recommendationRules.js';
import { feeProjection, FEE_BENCHMARK } from './feeProjection.js';

export const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
export const money = value => number(value) == null ? 'לא התקבל' : `₪${number(value).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
export const percent = value => number(value) == null ? 'לא התקבל' : `${number(value)}%`;
export function birthDate(snapshot) {
  if (snapshot.client_info?.birth) return snapshot.client_info.birth;
  const iso = snapshot.profile?.birth_date?.slice(0, 10);
  return iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : null;
}
// Some clearinghouse blocks mix study funds and provident accounts under one product code.
// Use the account's own explicit product/track name, never the managing company's name.
export function normalizeFundCategory(fund) {
  if (!['gemel', 'study'].includes(fund.type)) return fund;
  const text = `${fund.name || ''} ${fund.investmentTrack || ''}`;
  if (/השתלמות/.test(text)) return { ...fund, type: 'gemel', productType: 'קרן השתלמות' };
  if (/תגמולים\s*(?:ו?פיצויים)?|קופ["״]?ג|קופת\s*גמל/.test(text) && !/גמל\s*להשקעה|חיסכון\s*לכל\s*ילד/.test(text)) return { ...fund, type: 'gemel', productType: 'קופת גמל' };
  return fund;
}
export function fundGroup(fund) {
  if (fund.type === 'managers') return 'ביטוח מנהלים';
  if (fund.type === 'pension') return 'קרנות פנסיה';
  if (fund.productType === 'קרן השתלמות' || fund.type === 'study') return 'קרנות השתלמות';
  return fund.productType || 'קופות גמל';
}
export function recommendationFor(fund, snapshot) {
  if (fund.type !== 'pension' || number(fund.balance) === 0) return null;
  const fee = number(fund.feeFromAccumulation);
  const depositFee = number(fund.feeFromDeposit);
  if (!(fee > 0.15 || depositFee > 1.5)) return null;
  const offer = FEE_BENCHMARK;
  const { months, saving } = feeProjection(snapshot.source === 'demo' ? { ...fund, monthlyDepositVerified: true } : fund, birthDate(snapshot));
  if (saving != null && saving <= 0) return null;
  return { fund, offer, saving, months };
}
export function portfolio(snapshot) {
  const insurance = dedupById([...(snapshot.insurance_data || []), ...(snapshot.har_bituach_data || [])]);
  const funds = dedupById([...(snapshot.pension_data || []), ...insurance.filter(item => item.type === 'managers')]).map(normalizeFundCategory);
  const policies = insurance.filter(item => item.type !== 'managers');
  const categories = [...new Set(funds.map(fundGroup))].map(name => ({ name, items: funds.filter(f => fundGroup(f) === name), value: funds.filter(f => fundGroup(f) === name).reduce((sum, f) => sum + (number(f.balance) || 0), 0) }));
  return {
    funds, policies, categories,
    total: funds.reduce((sum, item) => sum + (number(item.balance) || 0), 0),
    unknownBalances: funds.filter(item => number(item.balance) == null).length,
    premium: policies.reduce((sum, item) => sum + (number(item.monthlyPremium) || 0), 0),
    unknownPremiums: policies.filter(item => number(item.monthlyPremium) == null).length,
    recommendations: [
      ...[consolidationReview(funds)].filter(Boolean),
      ...funds.filter(fund => ['pension', 'gemel', 'study'].includes(fund.type) && number(fund.balance) > 0 && isAgeTrack(fund)).map(fund => ({ kind: 'age', fund })),
      ...funds.map(fund => recommendationFor(fund, snapshot)).filter(Boolean),
    ],
  };
}

export function makeDemo() {
  return {
    source: 'demo', loadedAt: new Date().toISOString(),
    client_info: { first: 'דוד', last: 'ישראלי', birth: '01/05/1990' }, profile: { monthly_income: 14000 },
    pension_data: [
      { id: 'demo-pension', detailData: {
        openedAt: '01/01/2025', updatedAt: '31/08/2026', lastDepositDate: '01/08/2026', employers: ['חברה לדוגמה בע״מ'],
        deposits: [2400, 2500, 2500, 2590, 2590, 2590, 2590, 2590].map((amount, i) => ({ month: `${i + 1}/26`, amount })),
        disability: { rate: 75, pension: 6000, cost: 18 },
        survivors: { cost: 7, spouse: { rate: 60, pension: 4800 }, orphan: { rate: 40, pension: 3200 } },
      }, type: 'pension', name: 'קרן פנסיה מקיפה', provider: 'מגדל', balance: 210000, feeFromDeposit: 3.5, feeFromAccumulation: 0.9, monthlyDeposit: 2590, investmentTrack: 'לבני 50 ומטה', status: 'פעיל' },
      { id: 'demo-gemel', type: 'gemel', productType: 'גמל להשקעה', name: 'גמל להשקעה', provider: 'הראל', balance: 45000, feeFromDeposit: 0, feeFromAccumulation: 0.7, investmentTrack: 'מניות', status: 'פעיל' },
      { id: 'demo-study', type: 'gemel', productType: 'קרן השתלמות', name: 'קרן השתלמות', provider: 'כלל', balance: 38000, feeFromDeposit: 0, feeFromAccumulation: 0.6, investmentTrack: 'כללי', status: 'פעיל' },
    ],
    insurance_data: [
      { id: 'demo-life', type: 'life', name: 'ביטוח חיים', provider: 'הפניקס', monthlyPremium: 145, coverage: 800000, coverageItems: ['כיסוי למקרה מוות'], status: 'פעיל' },
      { id: 'demo-disability', type: 'disability', name: 'אובדן כושר עבודה', provider: 'מגדל', monthlyPremium: 180, coverage: null, coverageItems: ['75% מהשכר המבוטח', 'תקופת המתנה: 90 יום'], status: 'פעיל' },
    ], har_bituach_data: [], warnings: [],
  };
}
