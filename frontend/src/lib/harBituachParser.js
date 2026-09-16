// פרסור קובץ Excel של "הר הביטוח" - דוח מרוכז לכמה לקוחות, שורה = פוליסה, ת"ז בעמודה הראשונה.
// port נאמן ל-Python parser (C:\Users\david\.claude\skills\masalka-har-bituach-parser\parsers.py)
import * as XLSX from 'xlsx';

function cell(row, i) {
  const v = row[i];
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

// תיקון תפס אמיתי: קבצי הר ביטוח מגיעים עם !ref (טווח התאים המוצהר) שגוי -
// מכסה רק את השורות הראשונות ומחתך בשקט את כל הנתונים האמיתיים. מחשבים טווח אמיתי מהתאים בפועל.
function fixSheetRange(sheet) {
  let maxRow = 0, maxCol = 0;
  for (const key in sheet) {
    if (key[0] === '!') continue;
    const addr = XLSX.utils.decode_cell(key);
    if (addr.r > maxRow) maxRow = addr.r;
    if (addr.c > maxCol) maxCol = addr.c;
  }
  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });
}

export function parseHarBituach(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  fixSheetRange(sheet);
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

function monthlyOf(row) {
  const premiumNum = parseFloat(row.premium) || 0;
  return row.premiumType && row.premiumType.includes('שנתי') ? premiumNum / 12 : premiumNum;
}

// שורה בקובץ = כיסוי בודד, לא פוליסה - כמה שורות עם אותו מספר פוליסה שייכות לאותה פוליסה בפועל.
// מקבצים לפי מספר פוליסה: כרטיס אחד לפוליסה, פרמיה כוללת, וכל הכיסויים בפירוט (נפתח בחץ).
export function groupHarBituachByPolicy(rows) {
  const byPolicy = new Map();
  for (const row of rows) {
    const key = row.policyNum || `${row.company}-${row.product}`;
    if (!byPolicy.has(key)) byPolicy.set(key, []);
    byPolicy.get(key).push(row);
  }

  return Array.from(byPolicy.entries()).map(([policyNum, policyRows]) => {
    const first = policyRows[0];
    const monthlyPremium = Math.round(policyRows.reduce((s, r) => s + monthlyOf(r), 0));
    return {
      id: policyNum,
      type: guessType(`${first.section} ${first.branch} ${first.product}`),
      name: first.branch || first.product,
      provider: first.company,
      monthlyPremium,
      coverage: null,
      coverageItems: policyRows.map(r => {
        const label = [r.subBranch, r.product].filter(Boolean).join(' - ') || 'כיסוי';
        const amount = parseFloat(r.premium) ? `₪${r.premium}${r.premiumType ? ` (${r.premiumType})` : ''}` : '';
        return amount ? `${label} — ${amount}` : label;
      }),
    };
  });
}
