export function normalizeReportId(value) {
  const text = String(value ?? '').trim();
  if (!/^\d{1,16}$/.test(text)) return null;
  const digits = text.replace(/^0+/, '');
  return digits.length > 0 && digits.length <= 9 ? digits.padStart(9, '0') : null;
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function validateReport(report, clientIdNumber) {
  if (!report || !['maslaka', 'har_bituach'].includes(report.source)) throw new Error('מקור דוח לא תקין');
  if (!validDate(report.asOfDate) || (report.issuedOn && !validDate(report.issuedOn))) throw new Error('יש למלא תאריך נתונים תקין');
  if (report.issuedOn && report.issuedOn < report.asOfDate) throw new Error('תאריך הפקה מוקדם מתאריך הנתונים');
  const expected = normalizeReportId(clientIdNumber);
  if (!expected || normalizeReportId(report.subjectId) !== expected) throw new Error('תעודת הזהות בדוח אינה תואמת ללקוח');
  const keys = report.source === 'maslaka' ? ['pensionData', 'insuranceData'] : ['harBituachData'];
  let count = 0;
  const payload = {};
  for (const key of keys) {
    const rows = report[key];
    if (!Array.isArray(rows) || rows.length > 5000 || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('רשימת מוצרים לא תקינה');
    for (const row of rows) {
      if (['id', 'name', 'provider'].some(field => typeof row[field] !== 'string') ||
          ['balance', 'monthlyPremium'].some(field => row[field] != null && (typeof row[field] !== 'number' || !Number.isFinite(row[field]))) ||
          (row.coverageItems != null && (!Array.isArray(row.coverageItems) || row.coverageItems.some(value => typeof value !== 'string')))) throw new Error('פרטי מוצר לא תקינים');
    }
    payload[key] = rows;
    count += rows.length;
  }
  if (!count) throw new Error('אין מוצרים בדוח');
  return payload;
}
