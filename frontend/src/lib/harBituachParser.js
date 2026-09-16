// פרסור קובץ Excel של "הר הביטוח" - דוח מרוכז לכמה לקוחות, שורה = פוליסה, ת"ז בעמודה הראשונה.
// port נאמן ל-Python parser (C:\Users\david\.claude\skills\masalka-har-bituach-parser\parsers.py)
import * as XLSX from 'xlsx';

function cell(row, i) {
  const v = row[i];
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

export function parseHarBituach(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

  const policies = [];
  let currentSection = '';

  for (const row of rows) {
    const vals = row.map((_, i) => cell(row, i));
    if (!vals.some(v => v)) continue;

    const tz = vals[0];
    if (!tz || !/^\d+$/.test(tz)) {
      const sectionCell = vals.find(v => v.includes('תחום') || v.includes('אגף'));
      if (sectionCell) currentSection = sectionCell.replace('תחום -', '').replace('אגף -', '').trim();
      continue;
    }

    policies.push({
      tz,
      section: currentSection,
      branch: vals[1] || '',
      subBranch: vals[2] || '',
      product: vals[3] || '',
      company: vals[4] || '',
      period: vals[5] || '',
      notes: vals[6] || '',
      premium: vals[7] || '',
      premiumType: vals[8] || '',
      policyNum: vals[9] || '',
      classification: vals[10] || '',
    });
  }

  return policies;
}

function guessType(text) {
  if (!text) return 'other';
  if (text.includes('בריאות')) return 'health';
  if (text.includes('חיים')) return 'life';
  if (text.includes('מנהלים') || text.includes('פנסי')) return 'managers';
  if (text.includes('תאונות')) return 'accident';
  if (text.includes('ריסק')) return 'life';
  return 'other';
}

export function mapHarBituachRowToCard(row) {
  const premiumNum = parseFloat(row.premium) || null;
  const monthlyPremium = premiumNum && row.premiumType && row.premiumType.includes('שנתי')
    ? Math.round(premiumNum / 12)
    : premiumNum;
  return {
    id: row.policyNum || `harbituach-${row.company}-${row.product}`,
    type: guessType(`${row.section} ${row.branch} ${row.product}`),
    name: row.product || row.branch,
    provider: row.company,
    monthlyPremium,
    coverage: null,
    coverageItems: [row.classification, row.notes, row.subBranch].filter(Boolean).length
      ? [row.classification, row.notes, row.subBranch].filter(Boolean)
      : ['מקור: הר הביטוח'],
  };
}
