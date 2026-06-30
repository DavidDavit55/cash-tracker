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
  'חשמל ומחשבים': 'שונות',
  'בריאות': 'בריאות ורפואה',
  'בילוי ופנאי': 'בידור ופנאי',
  'ביגוד והנעלה': 'קניות ובגדים',
  'חינוך': 'חינוך',
  'ביטוח': 'שונות',
  'תקשורת': 'שונות',
  // רייזאפ
  'ביטוח': 'שונות',
  'בריאות': 'בריאות ורפואה',
  'דיגיטל': 'שונות',
  'כללי': 'שונות',
  'תקשורת': 'שונות',
  'תרומה': 'שונות',
  'אחר': 'שונות',
  'רכב': 'תחבורה',
  'מזון': 'מזון וסופר',
  'מסעדות': 'מסעדות ובתי קפה',
  'קניות': 'קניות ובגדים',
  'בילוי': 'בידור ופנאי',
  'RiseUp': 'שונות',
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
const CREDIT_KEYWORDS = ['חיוב לכרטיס', 'מקס איט פי', 'חיוב כרטיס', 'ויזה כאל', 'ישראכרט', 'חיוב ממקס'];

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
      });
    } else {
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
    // זהה פורמט: סכום בעמודה 2 (כאל ישן) או עמודה 5 (כאל חדש/מקס)
    const amountCol = String(header[2] || '').includes('סכום') ? 2 : 5;
    const categoryCol = amountCol === 5 ? 2 : null;

    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      const amount = parseFloat(row[amountCol]);
      if (isNaN(amount) || amount <= 0) continue;
      result.push({
        expense_date: excelDateToJS(row[0]),
        merchant: String(row[1] || '').trim(),
        amount,
        description: `כאל - ${sheetName}`,
        riseup_category: categoryCol !== null ? String(row[categoryCol] || '').trim() : null,
      });
    }
  }
  return result;
}

function parseMax(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  // שורה 2 = כותרות (index 1)
  let headerRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i]?.[0];
    if (cell && String(cell).includes('תאריך')) { headerRow = i; break; }
  }
  if (headerRow === -1) return [];
  const result = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    // סנן אשראי מתגלגל
    const merchant = String(row[1] || '').trim();
    const txType = String(row[4] || '').trim();
    if (merchant.includes('יתרת עסקות מצטברת') || txType.includes('העברה לסל מצטבר')) continue;

    // פורמט חדש: סכום בעמודה 5, קטגוריה בעמודה 2
    // פורמט ישן: סכום בעמודה 2
    const amount = parseFloat(row[5]) || parseFloat(row[2]);
    if (isNaN(amount) || amount <= 0) continue;
    const category = String(row[2] || '').trim();
    result.push({
      expense_date: excelDateToJS(row[0]),
      merchant,
      amount,
      description: `מקס - ${row[4] || 'רכישה'}`,
      riseup_category: isNaN(parseFloat(row[2])) ? category : null,
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
    await pool.query(
      `INSERT INTO incomes (user_id, amount, source, description, income_date, payment_method)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, row.amount, row.source, row.description, row.income_date, row.payment_method]
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
    // 2. מיפוי לפי קטגוריית מקור
    // 3. ברירת מחדל: שונות
    const categoryId =
      merchantMemory[row.merchant] ||
      catMap[CAT_MAP[row.riseup_category]] ||
      catMap['שונות'] ||
      null;

    const { rows: existing } = await pool.query(
      'SELECT id FROM expenses WHERE user_id=$1 AND merchant=$2 AND amount=$3 AND expense_date=$4',
      [userId, row.merchant, row.amount, row.expense_date]
    );
    if (existing.length > 0) { skipped++; continue; }

    await pool.query(
      `INSERT INTO expenses (user_id, category_id, amount, merchant, description, expense_date)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, categoryId, row.amount, row.merchant, row.description, row.expense_date]
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

export default router;
