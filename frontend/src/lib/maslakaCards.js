// מיפוי תוצאות הפרסור (מסלקה/הר ביטוח) לכרטיסי תצוגה, בנפרד מ-Import.jsx כדי שגם
// "פרסר מחדש את כולם" (על קבצים גולמיים ששמורים ב-DB) יוכל להשתמש באותה לוגיקה בדיוק.
import JSZip from 'jszip';
import { parseMaslakaFiles } from './maslakaParser';
import { parseHarBituach, groupHarBituachByPolicy } from './harBituachParser';
import { fmt } from '../components/ProductCard';

export async function extractXmlEntries(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const out = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir || !name.toLowerCase().endsWith('.xml')) continue;
    out.push({ name, text: await entry.async('string') });
  }
  return out;
}

// קובץ מסלקה אמיתי מגיע כ-ZIP עם XML + xls/pdf נלווים - שולפים רק את קובצי ה-XML.
// עדיין תומך גם בהעלאת XML בודדים ישירות (למקרה שהם כבר חולצו).
export async function filesFromUploads(fileList) {
  const out = [];
  for (const f of fileList) {
    if (f.name.toLowerCase().endsWith('.zip')) {
      out.push(...await extractXmlEntries(await f.arrayBuffer()));
    } else {
      out.push({ name: f.name, text: await f.text() });
    }
  }
  return out;
}

// ponytail: תיקון תצוגה זמני בלבד - בקבצים אמיתיים שדה שם התוכנית (SHEM-TOCHNIT) לפעמים
// מכיל טקסט של מסלול ביטוחי צמוד (נכות/שאירים) במקום שם מוצר. עד שנטפל בזה כמו שצריך
// (task_64850134 - לפרסר את הכיסוי הביטוחי בנפרד) פשוט לא מציגים את הטקסט הזה כשם הקרן.
const INSURANCE_RIDER_TEXT = /לנכות|לשארים|לשאירים/;

function mapPensionItemToCard(item, kind) {
  const tracks = item.tracks || [];
  const mainTrack = tracks.length ? tracks.reduce((a, b) => (b.pct || 0) > (a.pct || 0) ? b : a) : null;
  const balance = parseFloat(kind === 'pension' ? item.savings : item.tzvira);
  const planName = item.plan && !INSURANCE_RIDER_TEXT.test(item.plan) ? item.plan : null;
  return {
    id: item.policyNum || `${kind}-${item.plan}-${item.company}`,
    name: planName || item.company,
    provider: item.company,
    type: kind === 'pension' ? 'pension' : 'gemel',
    productType: item.productType || null,
    balance: isNaN(balance) ? 0 : balance,
    feeFromDeposit: item.dmeiNihulHafkada ? parseFloat(item.dmeiNihulHafkada) : null,
    feeFromAccumulation: item.dmeiNihulTzvira ? parseFloat(item.dmeiNihulTzvira) : null,
    monthlyDeposit: item.monthlyDeposit ? parseFloat(item.monthlyDeposit) : null,
    investmentTrack: mainTrack?.name || '',
    investmentTrackCode: mainTrack?.kod || '',
    stockExposure: null,
    isDefaultTrack: /\d+\s*(שנה|ומטה|ומעלה)|תלוי גיל/.test(mainTrack?.name || ''),
    return12m: item.netReturn ? parseFloat(item.netReturn) : null,
    status: item.status || null,
  };
}

function guessInsuranceType(label) {
  if (!label) return 'other';
  if (label.includes('אובדן כושר') || label.includes('אכ"ע') || label.includes('אכע')) return 'disability';
  if (label.includes('בריאות')) return 'health';
  if (label.includes('מנהלים')) return 'managers';
  if (label.includes('תאונות')) return 'accident';
  if (label.includes('חיים')) return 'life';
  if (label.includes('ריסק')) return 'life';
  return 'other';
}

function mapInsuranceItemToCard(entry, isManagers) {
  const premium = parseFloat(entry.premium) || null;
  const coverageItems = [];
  if (isManagers) {
    if (entry.riskAmount) coverageItems.push(`ריסק/חיים — כיסוי ${fmt(parseFloat(entry.riskAmount))}`);
    if (entry.akeMonthly) coverageItems.push(`אובדן כושר עבודה — קצבה חודשית ${fmt(parseFloat(entry.akeMonthly))}`);
    if (entry.track) coverageItems.push(`מסלול השקעה: ${entry.track}`);
    if (entry.tzvira) coverageItems.push(`צבירה: ${fmt(parseFloat(entry.tzvira))}`);
  } else if (entry.pledgedTo) {
    coverageItems.push(`משועבד ל: ${entry.pledgedTo}`);
  }
  const coverage = entry.sumInsured ? parseFloat(entry.sumInsured) : (entry.riskAmount ? parseFloat(entry.riskAmount) : null);
  const isTempRisk = /ריסק זמני/.test(`${entry.plan || ''} ${entry.type || ''}`);
  return {
    id: entry.policyNum || `${entry.company}-${entry.plan}`,
    type: guessInsuranceType(entry.type),
    name: entry.plan || entry.type,
    provider: entry.company,
    monthlyPremium: premium,
    balance: isManagers && entry.tzvira ? parseFloat(entry.tzvira) : null,
    coverage,
    status: entry.status || null,
    warning: isTempRisk ? 'yellow' : null,
    warningText: isTempRisk ? 'ריסק זמני' : null,
    pledgedTo: entry.pledgedTo || null,
    coverageItems: coverageItems.length ? coverageItems : ['אין פרטי כיסוי נוספים בקובץ המסלקה'],
    feeFromDeposit: isManagers && entry.dmeiNihulHafkada ? parseFloat(entry.dmeiNihulHafkada) : null,
    feeFromAccumulation: isManagers && entry.dmeiNihulTzvira ? parseFloat(entry.dmeiNihulTzvira) : null,
    investmentTrack: isManagers ? (entry.track || '') : null,
    investmentTrackCode: isManagers ? (entry.trackCode || '') : null,
    return12m: isManagers && entry.netReturn ? parseFloat(entry.netReturn) : null,
  };
}

// files: [{name, text}] קבצי XML גולמיים (אחרי חילוץ מה-ZIP) -> כרטיסי פנסיה/ביטוח + פרטי לקוח
export function processMaslakaFiles(files) {
  const result = parseMaslakaFiles(files);
  const pensionCards = [
    ...result.pension.map(p => mapPensionItemToCard(p, 'pension')),
    ...result.study_fund.map(s => mapPensionItemToCard(s, 'study_fund')),
  ];
  const insuranceCards = [
    ...result.insurance.map(e => mapInsuranceItemToCard(e, false)),
    ...result.managers_insurance.map(e => mapInsuranceItemToCard(e, true)),
  ];
  return { pensionCards, insuranceCards, clientInfo: result.client || null };
}

// arrayBuffer של קובץ הר ביטוח -> Map מ-ת.ז לכרטיסי פוליסה מקובצים
export function processHarBituachBuffer(arrayBuffer) {
  const rows = parseHarBituach(arrayBuffer);
  const byTz = new Map();
  for (const row of rows) {
    if (!byTz.has(row.tz)) byTz.set(row.tz, []);
    byTz.get(row.tz).push(row);
  }
  const cardsByTz = new Map();
  for (const [tz, tzRows] of byTz) cardsByTz.set(tz, groupHarBituachByPolicy(tzRows));
  return cardsByTz;
}
