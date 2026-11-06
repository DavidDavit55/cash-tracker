import { useEffect, useState } from 'react';
import { fetchRealFundData } from '../lib/pensionNetApi';
import { fetchCategoryAverage, fetchOwnLTM } from './marketComparison';
import { portfolio } from './model';
import { hasUnderperformance } from './recommendationRules';

const periods = [[12, 'שנה'], [36, '3 שנים'], [60, '5 שנים']];
export default function usePerformanceRecommendations(snapshot) {
  const [state, setState] = useState(null);
  useEffect(() => {
    let active = true;
    async function load() {
      const funds = portfolio(snapshot).funds.filter(f => ['pension', 'gemel', 'study'].includes(f.type) && Number(f.balance) > 0);
      const results = await Promise.all(funds.map(async fund => {
        let timer;
        try {
          return await Promise.race([
            (async () => {
              const type = fund.type === 'study' ? 'gemel' : fund.type;
              const market = await fetchRealFundData(fund.provider, type, fund.investmentTrack, fund.name, fund.investmentTrackCode);
              if (!market?.exactMatch) return { unavailable: true };
              const rows = await Promise.all(periods.map(async ([months, label]) => {
                try {
                  const [group, own] = await Promise.all([
                    fetchCategoryAverage(market.fundName, type, fund.productType, market.reportPeriod, months),
                    fetchOwnLTM(market.fundId, type, market.reportPeriod, months),
                  ]);
                  return { group, own, label };
                } catch { return { label }; }
              }));
              const unavailable = rows.some(row => !row.group || !Number.isFinite(row.own));
              return hasUnderperformance(rows) ? { kind: 'performance', unavailable, fund, result: { rows, period: String(market.reportPeriod) } } : unavailable ? { unavailable: true } : null;
            })(),
            new Promise(resolve => { timer = setTimeout(() => resolve({ unavailable: true }), 30000); }),
          ]);
        } catch { return { unavailable: true }; } finally { clearTimeout(timer); }
      }));
      if (active) setState({ snapshot, recommendations: results.filter(item => item?.kind === 'performance'), unavailable: results.filter(item => item?.unavailable).length });
    }
    load();
    return () => { active = false; };
  }, [snapshot]);
  return state?.snapshot === snapshot ? { recommendations: state.recommendations, unavailable: state.unavailable, loading: false } : { recommendations: [], loading: true };
}
