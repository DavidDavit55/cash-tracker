import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const upload = multer({ dest: 'uploads/tmp/' });

// מיפוי קטגוריות לקטגוריות שלנו
const CAT_MAP = {
  // כאל
  'מזון וצריכה': 'מזון וסופר',
  'תחבורה ורכבים': 'תחבורה',
  'חשמל ומחשבים': 'חשמל ומים',
  'בריאות': 'בריאות ורפואה',
  'בילוי ופנאי': 'בידור ופנאי',
  'ביגוד והנעלה': 'קניות ובגדים',
  'חינוך': 'חינוך',
  'ביטוח': 'ביטוח',
  'תקשורת': 'תקשורת',
  'תרומה': 'תרומות',
  // רייזאפ
  'דיגיטל': 'תקשורת',
  'כללי': 'שונות',
  'אחר': 'שונות',
  'רכב': 'תחבורה',
  'מזון': 'מזון וסופר',
  'מסעדות': 'מסעדות ובתי קפה',
  'קניות': 'קניות ובגדים',
  'בילוי': 'בידור ופנאי',
  'RiseUp': 'שונות',
};

// מיפוי שמות עסקים ידועים לקטגוריות (עדיפות שנייה אחרי merchant memory)
const MERCHANT_CAT_MAP = {
  // שכירות
  'שכ"ד': 'שכירות', 'שכירות': 'שכירות',
  // ועד וארנונה
  'ועד': 'ועד וארנונה', 'ארנונה': 'ועד וארנונה',
  // הלוואות
  'הלוואה': 'הלוואות',
  // עסקי
  'רו"ח': 'הוצאות עסקיות', 'שורנס': 'הוצאות עסקיות', 'וונגוס': 'הוצאות עסקיות',
  'אסמס': 'הוצאות עסקיות', 'פייפרלס': 'הוצאות עסקיות',
  'גוגל וורקספייס': 'הוצאות עסקיות', 'GOOGLE': 'הוצאות עסקיות',
  'מסלקה': 'הוצאות עסקיות', 'המסלקה': 'הוצאות עסקיות',
  // תחבורה
  'דלק': 'תחבורה', 'סדש': 'תחבורה', 'פז': 'תחבורה', 'סונול': 'תחבורה',
  'דן חברה': 'תחבורה', 'פנגו': 'תחבורה',
  // תקשורת
  'HOT': 'תקשורת', 'סלקום': 'תקשורת', 'פרטנר': 'תקשורת', 'אורנג': 'תקשורת',
  'APPLE': 'תקשורת', 'קלוד': 'תקשורת', 'CLAUDE': 'תקשורת',
  // ביטוח
  'איילון': 'ביטוח', 'הראל': 'ביטוח', 'פניקס': 'ביטוח', 'הפניקס': 'ביטוח',
  'מגדל': 'ביטוח', 'מנורה': 'ביטוח', 'שב"ן': 'ביטוח', 'שב״ן': 'ביטוח',
  'לאומית': 'ביטוח', 'כללית': 'ביטוח', 'מאוחדת': 'ביטוח',
  // מזון
  'שופרסל': 'מזון וסופר', 'רמי לוי': 'מזון וסופר', 'יוחננוף': 'מזון וסופר',
  'קרפור': 'מזון וסופר', 'CARREFOUR': 'מזון וסופר', 'מינימרקט': 'מזון וסופר',
  'מאפיה': 'מזון וסופר', 'מאפיית': 'מזון וסופר',
  // פארם / בריאות
  'סופר פארם': 'בריאות ורפואה', 'סופרפארם': 'בריאות ורפואה',
  'בית מרקחת': 'בריאות ורפואה',
  // תרומות
  'תרומה': 'תרומות', 'יד עזרא': 'תרומות', 'משכן רבי מאיר': 'תרומות',
  'קרן להנצחת': 'תרומות', 'בית חב"ד': 'תרומות',
};

function excelDateToJS(val) {
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'string') {
    // DD-MM-YYYY
    if (val.match(/^\d{2}-\d{2}-\d{4}$/)) {
      const [d, m, y] = val.split('-');
      return `${y}-${m}-${d}`;
    }
    // DD/MM/YYYY
    if (val.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [d, m, y] = val.split('/');
      return `${y}-${m}-${d}`;
    }
    return val;
  }
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    return `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`;
  }
  return new Date().toISOString().split('T')[0];
}

// ---- PARSERS ----

const INSURANCE_KEYWORDS = ['איילון', 'הראל', 'פניקס', 'מגדל', 'כלל', 'מנורה', 'הפניקס', 'ביטוח', 'מבטחים', 'מיטב', 'הסתדרות', 'חבר'];
const CREDIT_KEYWORDS = ['חיוב לכרטיס', 'מקס איט פי', 'חיוב כרטיס', 'ויזה כאל', 'ישראכרט', 'חיוב ממקס', 'חיוב זמני למפתח מזומן'];
// תנועות שאינן הכנסה אמיתית: הלוואות, העברות עצמיות, ריבית, מיסים
const NON_INCOME_KEYWORDS = ['הלוואה', 'קבלת תשלום על יתרת זכות', 'תשלום ריבית', 'תשלום מס במקור', 'העברה מדוד'];

function parseDiscount(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  let headerRow = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] && rows[i][0] && String(rows[i][0]).includes('תאריך')) {
      headerRow = i; break;
    }
  }
  if (headerRow === -1) return { expenses: [], incomes: [] };

  const expenses = [];
  const incomes = [];

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const amount = parseFloat(row[3]);
    if (isNaN(amount) || amount === 0) continue;
    const desc = String(row[2] || '').trim();
    const date = excelDateToJS(row[0]);

    // סנן חיובי אשראי משני הכיוונים
    if (CREDIT_KEYWORDS.some(k => desc.includes(k))) continue;

    if (amount < 0) {
      // הוצאה
      expenses.push({
        expense_date: date,
        merchant: desc,
        amount: Math.abs(amount),
        description: 'עו"ש דיסקונט',
        riseup_category: null,
        payment_method: 'בנק דיסקונט',
        card_number: null,
      });
    } else {
      // דלג על תנועות שאינן הכנסה אמיתית
      if (NON_INCOME_KEYWORDS.some(k => desc.includes(k))) continue;
      // הכנסה — זהה מקור
      const isInsurance = INSURANCE_KEYWORDS.some(k => desc.includes(k));
      incomes.push({
        income_date: date,
        source: isInsurance ? 'עמלות ביטוח' : 'אחר',
        description: desc,
        amount,
        payment_method: 'העברה בנקאית',
      });
    }
  }
  return { expenses, incomes };
}

function parseCal(wb) {
  const result = [];
  for (const sheetName of wb.SheetNames) {
    if (sheetName.includes('סיכום')) continue;
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    let headerRow = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][0] && String(rows[i][0]).includes('תאריך')) {
        headerRow = i; break;
      }
    }
    if (headerRow === -1) continue;
    const header = rows[headerRow];
    const amountCol = String(header[2] || '').includes('סכום') ? 2 : 5;
    const categoryCol = amountCol === 5 ? 2 : null;

    // נסה לחלץ 4 ספרות אחרונות של כרטיס משם הגיליון
    const sheetCardMatch = sheetName.match(/(\d{4})\s*$/);
    const sheetCardNumber = sheetCardMatch ? sheetCardMatch[1] : null;

    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      const amount = parseFloat(row[amountCol]);
      if (isNaN(amount) || amount <= 0) continue;
      const merchantName = String(row[1] || '').trim();
      if (merchantName.includes('יתרת אשראי מתגלגל') || merchantName.includes('יתרת עסקות מצטברת')) continue;

      // נסה לשלוף מספר כרטיס מעמודה 3 (למשל "ויזה 0508" או "0508")
      const col3 = String(row[3] || '');
      const rowCardMatch = col3.match(/(\d{4})\s*$/) || col3.match(/\b(\d{4})\b/);
      const cardNumber = sheetCardNumber || (rowCardMatch ? rowCardMatch[1] : null);

      result.push({
        expense_date: excelDateToJS(row[0]),
        merchant: merchantName,
        amount,
        description: `כאל - ${sheetName}`,
        riseup_category: categoryCol !== null ? String(row[categoryCol] || '').trim() : null,
        payment_method: 'כאל כרטיס אשראי',
        card_number: cardNumber,
      });
    }
  }
  return result;
}

function parseMax(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  let headerRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i]?.[0];
    if (cell && String(cell).includes('תאריך')) { headerRow = i; break; }
  }
  if (headerRow === -1) return [];

  // נסה לחלץ מספר כרטיס מהשורות שלפני הכותרת
  let cardNumber = null;
  for (let i = 0; i < headerRow; i++) {
    const rowText = (rows[i] || []).join(' ');
    const m = rowText.match(/\b(\d{4})\b/);
    if (m) { cardNumber = m[1]; break; }
  }

  const result = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const merchant = String(row[1] || '').trim();
    const txType = String(row[4] || '').trim();
    if (merchant.includes('יתרת עסקות מצטברת') || merchant.includes('יתרת אשראי מתגלגל') || txType.includes('העברה לסל מצטבר')) continue;

    const amount = parseFloat(row[5]) || parseFloat(row[2]);
    if (isNaN(amount) || amount <= 0) continue;
    const category = String(row[2] || '').trim();
    result.push({
      expense_date: excelDateToJS(row[0]),
      merchant,
      amount,
      description: `מקס - ${row[4] || 'רכישה'}`,
      riseup_category: isNaN(parseFloat(row[2])) ? category : null,
      payment_method: 'מקס כרטיס אשראי',
      card_number: cardNumber,
    });
  }
  return result;
}

// transaction-details_export (MAX / כרטיסי אשראי מקס) - עמודת "4 ספרות אחרונות"
function parseTransactionDetails(wb) {
  const result = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    let headerRow = -1;
    for (let i = 0; i < rows.length; i++) {
      const cell = String(rows[i]?.[0] || '');
      if (cell.includes('תאריך')) { headerRow = i; break; }
    }
    if (headerRow === -1) continue;
    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      const amount = parseFloat(row[5]);
      if (isNaN(amount) || amount <= 0) continue;
      const merchant = String(row[1] || '').trim();
      if (!merchant) continue;
      const cardNumber = row[3] ? String(row[3]).trim() : null;
      result.push({
        expense_date: excelDateToJS(row[0]),
        merchant,
        amount,
        description: `מקס - ${row[4] || 'רכישה'}`,
        riseup_category: String(row[2] || '').trim() || null,
        payment_method: 'מקס כרטיס אשראי',
        card_number: cardNumber,
      });
    }
  }
  return result;
}

// פירוט עסקאות וזיכויים - ויזה דיסקונט
function parseDiscountVisa(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  // כותרת בשורה 1 (index 1): תאריך עסקה, שם בית עסק, סכום, כרטיס, ...
  const headerRow = 1;
  const result = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const amount = parseFloat(row[2]);
    if (isNaN(amount) || amount <= 0) continue;
    const merchant = String(row[1] || '').trim();
    if (!merchant) continue;
    // כרטיס: "ויזה 0508" → card_number = "0508"
    const cardRaw = String(row[3] || '');
    const cardMatch = cardRaw.match(/(\d{4})\s*$/);
    result.push({
      expense_date: excelDateToJS(row[0]),
      merchant,
      amount,
      description: `ויזה דיסקונט - ${row[5] || 'רכישה'}`,
      riseup_category: null,
      payment_method: 'ויזה דיסקונט',
      card_number: cardMatch ? cardMatch[1] : null,
    });
  }
  return result;
}

function parseRiseUpCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].replace(/^﻿/, '').split(',');
  const nameIdx = header.findIndex(h => h.includes('שם העסק'));
  const amountIdx = header.findIndex(h => h === 'סכום');
  const dateIdx = header.findIndex(h => h.includes('תאריך התשלום'));
  const catIdx = header.findIndex(h => h.includes('קטגוריה'));
  const excludedIdx = header.findIndex(h => h.includes('מוחרג'));
  const paymentIdx = header.findIndex(h => h.includes('אמצעי התשלום'));
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 5) continue;
    const amount = parseFloat(cols[amountIdx]);
    if (isNaN(amount) || amount >= 0) continue;
    if (cols[excludedIdx]?.trim() === 'true') continue;
    const dateStr = cols[dateIdx]?.trim();
    let expenseDate = new Date().toISOString().split('T')[0];
    if (dateStr?.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      expenseDate = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    result.push({
      merchant: cols[nameIdx]?.trim(),
      amount: Math.abs(amount),
      expense_date: expenseDate,
      riseup_category: cols[catIdx]?.trim(),
      description: `רייזאפ - ${cols[paymentIdx]?.trim() || 'אשראי'}`,
    });
  }
  return result;
}

async function saveIncomes(incomes, userId) {
  let imported = 0, skipped = 0;
  for (const row of incomes) {
    const { rows: existing } = await pool.query(
      'SELECT id FROM incomes WHERE user_id=$1 AND description=$2 AND amount=$3 AND income_date=$4',
      [userId, row.description, row.amount, row.income_date]
    );
    if (existing.length > 0) { skipped++; continue; }
    const includes_vat = row.source === 'עמלות ביטוח';
    await pool.query(
      `INSERT INTO incomes (user_id, amount, source, description, income_date, payment_method, includes_vat)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, row.amount, row.source, row.description, row.income_date, row.payment_method, includes_vat]
    );
    imported++;
  }
  return { imported, skipped };
}

async function saveRows(rows, userId) {
  const { rows: cats } = await pool.query('SELECT id, name FROM categories WHERE user_id=$1', [userId]);
  const catMap = Object.fromEntries(cats.map(c => [c.name, c.id]));

  // טען זיכרון קטגוריות של המשתמש
  const { rows: memRows } = await pool.query(
    'SELECT merchant, category_id FROM merchant_categories WHERE user_id=$1', [userId]
  );
  const merchantMemory = Object.fromEntries(memRows.map(r => [r.merchant, r.category_id]));

  let imported = 0, skipped = 0;
  for (const row of rows) {
    // 1. זיכרון אישי (עדיפות ראשונה)
    // 2. זיהוי לפי שם עסק (MERCHANT_CAT_MAP)
    // 3. מיפוי לפי קטגוריית מקור (CAT_MAP)
    // 4. ברירת מחדל: שונות
    const merchantCatName = Object.keys(MERCHANT_CAT_MAP).find(k => row.merchant?.includes(k));
    const categoryId =
      merchantMemory[row.merchant] ||
      (merchantCatName ? catMap[MERCHANT_CAT_MAP[merchantCatName]] : null) ||
      catMap[CAT_MAP[row.riseup_category]] ||
      catMap['שונות'] ||
      null;

    const { rows: existing } = await pool.query(
      'SELECT id FROM expenses WHERE user_id=$1 AND merchant=$2 AND amount=$3 AND expense_date=$4',
      [userId, row.merchant, row.amount, row.expense_date]
    );
    if (existing.length > 0) { skipped++; continue; }

    await pool.query(
      `INSERT INTO expenses (user_id, category_id, amount, merchant, description, expense_date, payment_method, card_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId, categoryId, row.amount, row.merchant, row.description, row.expense_date,
       row.payment_method || 'לא צוין', row.card_number || null]
    );
    imported++;
  }
  return { imported, skipped, total: rows.length };
}

// POST /import/riseup (CSV)
router.post('/riseup', upload.single('csv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'קובץ חסר' });
  try {
    const content = fs.readFileSync(req.file.path, 'utf8');
    fs.unlinkSync(req.file.path);
    const rows = parseRiseUpCSV(content);
    if (!rows.length) return res.status(400).json({ error: 'לא נמצאו הוצאות' });
    const result = await saveRows(rows, req.user.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בייבוא' });
  }
});

// POST /import/discount
router.post('/discount', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'קובץ חסר' });
  try {
    const wb = XLSX.readFile(req.file.path);
    fs.unlinkSync(req.file.path);
    const { expenses, incomes } = parseDiscount(wb);
    if (!expenses.length && !incomes.length) return res.status(400).json({ error: 'לא נמצאו תנועות בקובץ — ייתכן שהפורמט השתנה' });
    const expResult = await saveRows(expenses, req.user.id);
    const incResult = await saveIncomes(incomes, req.user.id);
    res.json({
      imported: expResult.imported + incResult.imported,
      skipped: expResult.skipped + incResult.skipped,
      total: expResult.total + incomes.length,
      expenses: expResult,
      incomes: incResult,
    });
  } catch (err) {
    console.error('Discount import error:', err);
    res.status(500).json({ error: `שגיאה: ${err.message}` });
  }
});

// POST /import/cal
router.post('/cal', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'קובץ חסר' });
  try {
    const wb = XLSX.readFile(req.file.path);
    fs.unlinkSync(req.file.path);
    const rows = parseCal(wb);
    if (!rows.length) return res.status(400).json({ error: 'לא נמצאו הוצאות' });
    const result = await saveRows(rows, req.user.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בייבוא' });
  }
});

// POST /import/max
router.post('/max', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'קובץ חסר' });
  try {
    const wb = XLSX.readFile(req.file.path);
    fs.unlinkSync(req.file.path);
    const rows = parseMax(wb);
    if (!rows.length) return res.status(400).json({ error: 'לא נמצאו הוצאות' });
    const result = await saveRows(rows, req.user.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בייבוא' });
  }
});

// POST /import/discount-auto — מזהה אוטומטית עו"ש או ויזה דיסקונט
router.post('/discount-auto', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'קובץ חסר' });
  try {
    const wb = XLSX.readFile(req.file.path);
    fs.unlinkSync(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const firstRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, range: 0 }).slice(0, 3);
    const topText = firstRows.map(r => (r || []).join(' ')).join(' ');
    let result;
    if (topText.includes('פירוט עסקאות') || topText.includes('ויזה')) {
      const rows = parseDiscountVisa(wb);
      if (!rows.length) return res.status(400).json({ error: 'לא נמצאו עסקאות' });
      result = await saveRows(rows, req.user.id);
      result.source = 'ויזה דיסקונט';
    } else {
      const { expenses, incomes } = parseDiscount(wb);
      if (!expenses.length && !incomes.length) return res.status(400).json({ error: 'לא נמצאו תנועות' });
      const expResult = await saveRows(expenses, req.user.id);
      const incResult = await saveIncomes(incomes, req.user.id);
      result = { imported: expResult.imported + incResult.imported, skipped: expResult.skipped + incResult.skipped, source: 'עו"ש דיסקונט' };
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `שגיאה: ${err.message}` });
  }
});

// POST /import/max-auto — מזהה אוטומטית transaction-details או פורמט ישן
router.post('/max-auto', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'קובץ חסר' });
  try {
    const wb = XLSX.readFile(req.file.path);
    fs.unlinkSync(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const firstRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }).slice(0, 5);
    const topText = firstRows.map(r => (r || []).join(' ')).join(' ');
    let rows;
    if (topText.includes('4 ספרות') || topText.includes('כל הכרטיסים')) {
      rows = parseTransactionDetails(wb);
    } else {
      rows = parseMax(wb);
    }
    if (!rows.length) return res.status(400).json({ error: 'לא נמצאו עסקאות' });
    const result = await saveRows(rows, req.user.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `שגיאה: ${err.message}` });
  }
});

// POST /import/transaction-details (מקס - transaction-details_export)
router.post('/transaction-details', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'קובץ חסר' });
  try {
    const wb = XLSX.readFile(req.file.path);
    fs.unlinkSync(req.file.path);
    const rows = parseTransactionDetails(wb);
    if (!rows.length) return res.status(400).json({ error: 'לא נמצאו הוצאות' });
    const result = await saveRows(rows, req.user.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בייבוא' });
  }
});

// POST /import/discount-visa (ויזה דיסקונט - פירוט עסקאות וזיכויים)
router.post('/discount-visa', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'קובץ חסר' });
  try {
    const wb = XLSX.readFile(req.file.path);
    fs.unlinkSync(req.file.path);
    const rows = parseDiscountVisa(wb);
    if (!rows.length) return res.status(400).json({ error: 'לא נמצאו הוצאות' });
    const result = await saveRows(rows, req.user.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בייבוא' });
  }
});

export default router;
