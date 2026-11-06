export function isAgeTrack(fund) {
  return /(?:לבני|גילאי)\s*\d{2}|תלוי.?גיל|יעד\s*(?:לפרישה|פרישה)|(?:לפרישה|פרישה)\s*20\d{2}/.test(fund.investmentTrack || '');
}
export function comparableRows(rows = []) {
  return rows.filter(row => Number.isFinite(row.own) && Number.isFinite(row.group?.average) && row.group.byCompany?.length >= 2);
}
export function hasUnderperformance(rows) {
  return comparableRows(rows).some(row => row.own < row.group.average - 0.005);
}
export function consolidationReview(funds) {
  const pensions = funds.filter(fund => fund.type === 'pension');
  const status = fund => String(fund.status || '').trim();
  const active = pensions.filter(fund => ['פעיל', 'פעילה'].includes(status(fund)));
  const inactive = pensions.filter(fund => ['לא פעיל', 'לא פעילה'].includes(status(fund)) && Number.isFinite(Number(fund.balance)) && Number(fund.balance) > 0);
  if (active.length !== 1 || !inactive.length) return null;
  return { kind: 'consolidation', fund: active[0], inactive, balance: inactive.reduce((sum, fund) => sum + Number(fund.balance), 0) };
}
