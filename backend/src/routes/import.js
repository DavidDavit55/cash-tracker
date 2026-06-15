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

function parseDiscount(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  // מצא שורת כותרות
  let headerRow = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] && rows[i][0] && String(rows[i][0]).includes('תאריך')) {
      headerRow = i; break;
    }
  }
  if (headerRow === -1) return [];
  const result = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const amount = parseFloat(row[3]);
    if (isNaN(amount) || amount >= 0) continue; // רק הוצאות
    // סנן חיובי אשראי (כבר מיובאים מכאל/מקס)
    const desc = String(row[2] || '').trim();
    const creditKeywords = ['חיוב לכרטיס', 'מקס איט פי', 'חיוב כרטיס', 'ויזה כאל', 'ישראכרט'];
    if (creditKeywords.some(k => desc.includes(k))) continue;
    result.push({
      expense_date: excelDateToJS(row[0]),
      merchant: String(row[2] || '').trim(),
      amount: Math.abs(amount),
      description: 'עו"ש דיסקונט',
      riseup_category: null,
    });
  }
  return result;
}

function parseCal(wb) {
  const result = [];
  // שני sheets: עסקאות רגילות + חו"ל
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
    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      const amount = parseFloat(row[5]);
      if (isNaN(amount) || amount <= 0) continue;
      result.push({
        expense_date: excelDateToJS(row[0]),
        merchant: String(row[1] || '').trim(),
        amount,
        description: `כאל - ${sheetName}`,
        riseup_category: String(row[2] || '').trim(),
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
    const amount = parseFloat(row[2]);
    if (isNaN(amount) || amount <= 0) continue;
    result.push({
      expense_date: excelDateToJS(row[0]),
      merchant: String(row[1] || '').trim(),
      amount,
      description: `מקס - ${row[4] || 'רכישה'}`,
      riseup_category: null,
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

async function saveRows(rows, userId) {
  const { rows: cats } = await pool.query('SELECT id, name FROM categories WHERE user_id=$1', [userId]);
  const catMap = Object.fromEntries(cats.map(c => [c.name, c.id]));

  let imported = 0, skipped = 0;
  for (const row of rows) {
    const mappedCat = CAT_MAP[row.riseup_category] || 'שונות';
    const categoryId = catMap[mappedCat] || catMap['שונות'] || null;

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
    const rows = parseDiscount(wb);
    console.log('Discount parsed rows:', rows.length, rows[0]);
    if (!rows.length) return res.status(400).json({ error: 'לא נמצאו הוצאות בקובץ — ייתכן שהפורמט השתנה' });
    const result = await saveRows(rows, req.user.id);
    res.json(result);
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
