import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function extractReceiptData(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const ext = path.extname(imagePath).slice(1).toLowerCase();
  const mediaType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        {
          type: 'text',
          text: `נתח את הקבלה הזו והחזר JSON בלבד עם השדות הבאים (ללא הסברים):
{
  "amount": מספר (סכום לתשלום בשקלים),
  "merchant": "שם העסק",
  "date": "YYYY-MM-DD",
  "description": "תיאור קצר של הקנייה"
}
אם לא ניתן לחלץ שדה, השתמש ב-null.`
        }
      ]
    }]
  });

  try {
    const text = response.content[0].text.trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

// POST /expenses/scan — OCR only, no save
router.post('/scan', upload.single('receipt'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'קובץ חסר' });
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'ANTHROPIC_API_KEY לא מוגדר' });
    }
    const ocr = await extractReceiptData(req.file.path);
    fs.unlinkSync(req.file.path);
    res.json(ocr);
  } catch (err) {
    console.error('OCR error:', err);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'שגיאה בסריקה' });
  }
});

// GET /expenses
router.get('/', async (req, res) => {
  const { month, year, category_id, limit = 50, offset = 0 } = req.query;
  let query = `
    SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE e.user_id = $1
  `;
  const params = [req.user.id];

  if (month && year) {
    params.push(month, year);
    query += ` AND EXTRACT(MONTH FROM e.expense_date) = $${params.length - 1} AND EXTRACT(YEAR FROM e.expense_date) = $${params.length}`;
  }
  if (category_id) {
    params.push(category_id);
    query += ` AND e.category_id = $${params.length}`;
  }

  query += ` ORDER BY e.expense_date DESC, e.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// POST /expenses (with optional receipt)
router.post('/', upload.single('receipt'), async (req, res) => {
  const { amount, description, merchant, category_id, expense_date, notes } = req.body;
  let receiptUrl = null;
  let receiptFilename = null;
  let ocrRaw = null;
  let finalAmount = amount;
  let finalMerchant = merchant;
  let finalDescription = description;
  let finalDate = expense_date || new Date().toISOString().split('T')[0];

  try {
    if (req.file) {
      receiptFilename = req.file.filename;
      receiptUrl = `/uploads/${req.file.filename}`;

      if (process.env.ANTHROPIC_API_KEY) {
        const ocr = await extractReceiptData(req.file.path);
        ocrRaw = JSON.stringify(ocr);
        if (!finalAmount && ocr.amount) finalAmount = ocr.amount;
        if (!finalMerchant && ocr.merchant) finalMerchant = ocr.merchant;
        if (!finalDescription && ocr.description) finalDescription = ocr.description;
        if (!expense_date && ocr.date) finalDate = ocr.date;
      }
    }

    if (!finalAmount) return res.status(400).json({ error: 'סכום חסר' });

    const { rows } = await pool.query(
      `INSERT INTO expenses (user_id, category_id, amount, description, merchant, expense_date, receipt_url, receipt_filename, ocr_raw, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id, category_id || null, finalAmount, finalDescription || null, finalMerchant || null, finalDate, receiptUrl, receiptFilename, ocrRaw, notes || null]
    );

    res.json({ ...rows[0], ocr: ocrRaw ? JSON.parse(ocrRaw) : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// PUT /expenses/:id/receipt — עדכון קבלה בלבד
router.put('/:id/receipt', upload.single('receipt'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'קובץ חסר' });
  try {
    const receiptFilename = req.file.filename;
    const receiptUrl = `/uploads/${req.file.filename}`;

    // מחק קבלה ישנה
    const { rows: old } = await pool.query(
      'SELECT receipt_filename FROM expenses WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (old[0]?.receipt_filename) {
      const oldPath = path.join(uploadsDir, old[0].receipt_filename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const { rows } = await pool.query(
      `UPDATE expenses SET receipt_url=$1, receipt_filename=$2, updated_at=NOW()
       WHERE id=$3 AND user_id=$4 RETURNING *`,
      [receiptUrl, receiptFilename, req.params.id, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// PUT /expenses/:id
router.put('/:id', async (req, res) => {
  const { amount, description, merchant, category_id, expense_date, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE expenses SET amount=$1, description=$2, merchant=$3, category_id=$4, expense_date=$5, notes=$6, updated_at=NOW()
       WHERE id=$7 AND user_id=$8 RETURNING *`,
      [amount, description, merchant, category_id, expense_date, notes, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'לא נמצא' });

    // שמור זיכרון קטגוריה לפי שם עסק
    if (category_id && merchant) {
      await pool.query(
        `INSERT INTO merchant_categories (user_id, merchant, category_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, merchant) DO UPDATE SET category_id=$3, updated_at=NOW()`,
        [req.user.id, merchant, category_id]
      );
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// DELETE /expenses/:id
router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query(
    'DELETE FROM expenses WHERE id=$1 AND user_id=$2 RETURNING receipt_filename',
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'לא נמצא' });

  if (rows[0].receipt_filename) {
    const filePath = path.join(uploadsDir, rows[0].receipt_filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  res.json({ success: true });
});

// GET /expenses/stats/summary
router.get('/stats/summary', async (req, res) => {
  const { month, year } = req.query;
  const m = month || new Date().getMonth() + 1;
  const y = year || new Date().getFullYear();

  try {
    const { rows: byCategory } = await pool.query(
      `SELECT c.name, c.icon, c.color, SUM(e.amount) as total, COUNT(*) as count
       FROM expenses e LEFT JOIN categories c ON e.category_id = c.id
       WHERE e.user_id=$1 AND EXTRACT(MONTH FROM e.expense_date)=$2 AND EXTRACT(YEAR FROM e.expense_date)=$3
       GROUP BY c.id, c.name, c.icon, c.color ORDER BY total DESC`,
      [req.user.id, m, y]
    );

    const { rows: monthly } = await pool.query(
      `SELECT EXTRACT(MONTH FROM expense_date) as month, EXTRACT(YEAR FROM expense_date) as year, SUM(amount) as total
       FROM expenses WHERE user_id=$1 AND expense_date >= NOW() - INTERVAL '12 months'
       GROUP BY month, year ORDER BY year, month`,
      [req.user.id]
    );

    const { rows: total } = await pool.query(
      `SELECT SUM(amount) as total, COUNT(*) as count FROM expenses
       WHERE user_id=$1 AND EXTRACT(MONTH FROM expense_date)=$2 AND EXTRACT(YEAR FROM expense_date)=$3`,
      [req.user.id, m, y]
    );

    res.json({ byCategory, monthly, total: total[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
