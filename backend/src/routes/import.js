import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const upload = multer({ dest: 'uploads/csv/' });

// מיפוי קטגוריות רייזאפ לקטגוריות שלנו
const CATEGORY_MAP = {
  'ביטוח': 'ביטוח',
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
  'חינוך': 'חינוך',
  'RiseUp': 'שונות',
};

function parseRiseUpCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Remove BOM if present
  const header = lines[0].replace(/^﻿/, '').split(',');
  const nameIdx = header.findIndex(h => h.includes('שם העסק'));
  const amountIdx = header.findIndex(h => h === 'סכום');
  const dateIdx = header.findIndex(h => h.includes('תאריך התשלום'));
  const catIdx = header.findIndex(h => h.includes('קטגוריה'));
  const excludedIdx = header.findIndex(h => h.includes('מוחרג'));
  const paymentIdx = header.findIndex(h => h.includes('אמצעי התשלום'));
  const originalAmountIdx = header.findIndex(h => h.includes('סכום מקורי'));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 5) continue;

    const amount = parseFloat(cols[amountIdx]);
    if (isNaN(amount) || amount >= 0) continue; // רק הוצאות (סכום שלילי)

    const excluded = cols[excludedIdx]?.trim() === 'true';
    if (excluded) continue; // דלג על הוצאות לא תזרימיות

    const name = cols[nameIdx]?.trim();
    const dateStr = cols[dateIdx]?.trim(); // DD/MM/YYYY
    const category = cols[catIdx]?.trim();
    const paymentMethod = cols[paymentIdx]?.trim();

    // המר תאריך
    let expenseDate = new Date().toISOString().split('T')[0];
    if (dateStr && dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      expenseDate = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }

    rows.push({
      merchant: name,
      amount: Math.abs(amount),
      expense_date: expenseDate,
      riseup_category: category,
      payment_method: paymentMethod,
      description: `ייבוא מרייזאפ - ${paymentMethod || 'אשראי'}`,
    });
  }
  return rows;
}

// POST /import/riseup
router.post('/riseup', upload.single('csv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'קובץ CSV חסר' });

  try {
    const content = fs.readFileSync(req.file.path, 'utf8');
    fs.unlinkSync(req.file.path);

    const rows = parseRiseUpCSV(content);
    if (rows.length === 0) return res.status(400).json({ error: 'לא נמצאו הוצאות בקובץ' });

    // טען קטגוריות קיימות של המשתמש
    const { rows: cats } = await pool.query(
      'SELECT id, name FROM categories WHERE user_id = $1', [req.user.id]
    );
    const catMap = Object.fromEntries(cats.map(c => [c.name, c.id]));

    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      // מצא קטגוריה מתאימה
      const mappedCat = CATEGORY_MAP[row.riseup_category] || 'שונות';
      const categoryId = catMap[mappedCat] || catMap['שונות'] || null;

      // בדוק אם כבר קיים (לפי תאריך + שם + סכום)
      const { rows: existing } = await pool.query(
        `SELECT id FROM expenses WHERE user_id=$1 AND merchant=$2 AND amount=$3 AND expense_date=$4`,
        [req.user.id, row.merchant, row.amount, row.expense_date]
      );
      if (existing.length > 0) { skipped++; continue; }

      await pool.query(
        `INSERT INTO expenses (user_id, category_id, amount, merchant, description, expense_date)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.id, categoryId, row.amount, row.merchant, row.description, row.expense_date]
      );
      imported++;
    }

    res.json({ imported, skipped, total: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בייבוא הקובץ' });
  }
});

export default router;
