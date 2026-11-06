// Report dates come from the source, never from the upload clock.
export function reportDate(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{4})(\d{2})(\d{2})(?:\d{6})?$/) || text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const local = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const result = match ? `${match[1]}-${match[2]}-${match[3]}` : local ? `${local[3]}-${local[2]}-${local[1]}` : '';
  return result && Number.isFinite(Date.parse(result)) && new Date(result).toISOString().slice(0, 10) === result ? result : '';
}
export function onlyDate(values) {
  const unique = [...new Set(values.map(reportDate).filter(Boolean))];
  return unique.length === 1 ? unique[0] : '';
}
export function reportProducts(report) {
  const data = report?.payload || {};
  return [...(data.pensionData || []), ...(data.insuranceData || []), ...(data.harBituachData || [])];
}
