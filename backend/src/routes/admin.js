import { Router } from 'express';
import multer from 'multer';
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function requireAdmin(req, res, next) {
  if (!process.env.ADMIN_EMAIL || req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: 'אין הרשאה' });
  }
  next();
}

router.get('/clients', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, cp.phone, cp.id_number, cp.status, cp.created_at
       FROM client_profiles cp
       JOIN users u ON u.id = cp.user_id
       ORDER BY cp.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/clients/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, cp.*
       FROM client_profiles cp
       JOIN users u ON u.id = cp.user_id
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'לא נמצא' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.patch('/clients/:id/status', authMiddleware, requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'חסר סטטוס' });
  try {
    const { rows } = await pool.query(
      `UPDATE client_profiles SET status=$1 WHERE user_id=$2 RETURNING *`,
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'לא נמצא' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/clients/:id/financial-data', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT pension_data, insurance_data, har_bituach_data, client_info FROM client_financial_data WHERE user_id=$1',
      [req.params.id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.put('/clients/:id/financial-data', authMiddleware, requireAdmin, async (req, res) => {
  const { pensionData, insuranceData, harBituachData, clientInfo } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO client_financial_data (user_id, pension_data, insurance_data, har_bituach_data, client_info)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id) DO UPDATE SET
         pension_data = COALESCE($2, client_financial_data.pension_data),
         insurance_data = COALESCE($3, client_financial_data.insurance_data),
         har_bituach_data = COALESCE($4, client_financial_data.har_bituach_data),
         client_info = COALESCE($5, client_financial_data.client_info),
         updated_at = NOW()
       RETURNING *`,
      [req.params.id, pensionData ? JSON.stringify(pensionData) : null,
        insuranceData ? JSON.stringify(insuranceData) : null,
        harBituachData ? JSON.stringify(harBituachData) : null,
        clientInfo ? JSON.stringify(clientInfo) : null]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// מחיקת נתונים פיננסיים - מותר רק ליוזר הטסטינג הייעודי, אף פעם לא ללקוח אמיתי.
const TEST_CLIENT_EMAIL = 'test-claude-verify4@davit-fin.co.il';

router.delete('/clients/:id/financial-data', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rows: userRows } = await pool.query('SELECT email FROM users WHERE id=$1', [req.params.id]);
    if (!userRows[0] || userRows[0].email !== TEST_CLIENT_EMAIL) {
      return res.status(403).json({ error: 'מחיקה מותרת רק ליוזר הטסטינג' });
    }
    await pool.query('DELETE FROM client_financial_data WHERE user_id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// קבצי מקור גולמיים - נשמרים לצורך "פרסר מחדש את כולם" אחרי תיקון עתידי בפרסר.
router.post('/raw-uploads', authMiddleware, requireAdmin, upload.single('file'), async (req, res) => {
  const { source, userId } = req.body;
  if (!req.file || !source) return res.status(400).json({ error: 'חסר קובץ או source' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO raw_uploads (user_id, source, filename, file_data) VALUES ($1,$2,$3,$4) RETURNING id`,
      [userId || null, source, req.file.originalname, req.file.buffer]
    );
    res.json({ id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/raw-uploads', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ru.id, ru.user_id, ru.source, ru.filename, ru.uploaded_at, u.name AS user_name
       FROM raw_uploads ru LEFT JOIN users u ON u.id = ru.user_id
       ORDER BY ru.uploaded_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/raw-uploads/:id/file', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT filename, file_data FROM raw_uploads WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'לא נמצא' });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(rows[0].filename || 'file')}"`);
    res.send(rows[0].file_data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
