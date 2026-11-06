export const FEE_BENCHMARK = Object.freeze({ feeFromDeposit: 1.5, feeFromAccumulation: 0.15 });
const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;

export function retirementMonths(birth, today = new Date()) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(birth || '');
  if (!match) return null;
  const [, d, m, y] = match.map(Number);
  const born = new Date(y, m - 1, d);
  if (born.getFullYear() !== y || born.getMonth() !== m - 1 || born.getDate() !== d || born > today) return null;
  return Math.max(0, (y + 67 - today.getFullYear()) * 12 + m - 1 - today.getMonth() - (today.getDate() > d ? 1 : 0));
}

export function feeProjection(fund, birth, today = new Date()) {
  const months = retirementMonths(birth, today);
  const latest = [...(fund.detailData?.deposits || [])].filter(row => /^\d{6}$/.test(row.key || '')).sort((a, b) => b.key.localeCompare(a.key))[0];
  const monthly = latest ? numeric(latest.amount) : fund.monthlyDepositVerified ? numeric(fund.monthlyDeposit) : null;
  const balance = numeric(fund.balance), deposit = numeric(fund.feeFromDeposit), accumulation = numeric(fund.feeFromAccumulation);
  const result = { months, monthly, latest, data: [], saving: null, benchmark: FEE_BENCHMARK };
  if (months == null || months <= 0 || months > 49 * 12 || [monthly, balance, deposit, accumulation].some(v => v == null || v < 0) || deposit > 100 || accumulation > 100) return result;
  let current = balance, alternative = balance;
  const growth = Math.pow(1.04, 1 / 12);
  const step = (amount, fromDeposit, fromBalance) => { const factor = growth - fromBalance / 1200; return amount * factor + monthly * (1 - fromDeposit / 100) * Math.sqrt(factor); };
  result.data.push({ year: 0, current, alternative });
  for (let month = 1; month <= months; month++) {
    current = step(current, deposit, accumulation);
    alternative = step(alternative, FEE_BENCHMARK.feeFromDeposit, FEE_BENCHMARK.feeFromAccumulation);
    if (month % 12 === 0 || month === months) result.data.push({ year: Number((month / 12).toFixed(2)), current: Math.round(current), alternative: Math.round(alternative) });
  }
  result.saving = Math.round(alternative) - Math.round(current);
  return result;
}
