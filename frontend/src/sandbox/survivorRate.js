// Display the survivor pension as a percentage of the reported insured salary.
// Raw SHIUR-KISUY values are retained separately, not treated as salary percentages.
export function survivorSalaryRate(pension, salary) {
  if (pension == null || salary == null || !Number.isFinite(pension) || !Number.isFinite(salary) || pension < 0 || salary <= 0) return null;
  return Math.round(pension / salary * 10000) / 100;
}
