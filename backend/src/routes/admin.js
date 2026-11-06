import { reviewProducts, validateAssessments } from '../services/productReview.js';
import { getWhatsAppHistory } from '../services/whatsappHistory.js';
import { Router } from 'express';
import multer from 'multer';
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';
import { notifyClientNewRecommendations } from '../services/whatsappTwilio.js';

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

router.get('/clients/:id/messages', authMiddleware, requireAdmin, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { rows: [recipient] } = await pool.query('SELECT phone FROM client_profiles WHERE user_id=$1', [req.params.id]);
    if (!recipient) return res.status(404).json({ error: 'לא נמצא לקוח' });
    res.json(await getWhatsAppHistory(recipient.phone));
  } catch (err) {
    console.error('WhatsApp history lookup failed:', err.code || 'unknown');
    res.status(502).json({ error: 'לא ניתן לטעון כרגע את ההודעות משירות WhatsApp. נסה לרענן.' });
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
      'SELECT pension_data, insurance_data, har_bituach_data, client_info, review, review_draft, data_version FROM client_financial_data WHERE user_id=$1',
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
         updated_at = NOW(), review = NULL, review_draft = NULL, data_version = gen_random_uuid()
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


router.post('/clients/:id/review', authMiddleware, requireAdmin, async (req, res) => {
  const { text, agentName, publish, version, assessments } = req.body;
  if (typeof text !== 'string' || (!text.trim() && !assessments) || text.length > 20000 ||
      typeof agentName !== 'string' || !agentName.trim() || agentName.length > 120 ||
      typeof version !== 'string' || !/^[0-9a-f-]{36}$/i.test(version) || typeof publish !== 'boolean') {
    return res.status(400).json({ error: 'יש למלא שם סוכן, המלצות וגרסת תיק תקינה' });
  }
  const draft = { text: text.trim(), agentName: agentName.trim(), dataVersion: version, savedAt: new Date().toISOString() };
  try {
    if (assessments !== undefined) {
      const { rows: [record] } = await pool.query('SELECT pension_data, insurance_data, har_bituach_data FROM client_financial_data WHERE user_id=$1 AND data_version::text=$2', [req.params.id, version]);
      if (!record) return res.status(409).json({ error: 'נתוני התיק השתנו. רענן לפני שמירה.' });
      try { draft.assessments = validateAssessments(assessments, reviewProducts(record), publish); }
      catch (error) { return res.status(400).json({ error: error.message }); }
      if (!text.trim() && !Object.values(draft.assessments).some(entries => Object.values(entries).some(e => e.status !== 'unchecked'))) return res.status(400).json({error:'יש להוסיף ממצא או סיכום לפני שמירה'});
    }
    // Conditional UPDATE serializes with data uploads: stale reviews cannot be published.
    const { rows } = await pool.query(
      `UPDATE client_financial_data SET review_draft=$1,
       review=CASE WHEN $2 THEN $3::jsonb ELSE review END
       WHERE user_id=$4 AND data_version::text=$5
       RETURNING review, review_draft, data_version`,
      [JSON.stringify(draft), publish, JSON.stringify({ ...draft, publishedAt: new Date().toISOString() }), req.params.id, version]
    );
    if (!rows[0]) return res.status(409).json({ error: 'נתוני התיק השתנו. רענן ובדוק אותם לפני פרסום.' });
    let notification = { status: "not_requested" };
    if (publish) {
      const { rows: [recipient] } = await pool.query(
        'SELECT u.name, u.email, cp.phone FROM users u JOIN client_profiles cp ON cp.user_id=u.id WHERE u.id=$1',
        [req.params.id]
      );
      if (recipient?.phone && recipient.email !== process.env.ADMIN_EMAIL) {
        notification = await notifyClientNewRecommendations({ phone: recipient.phone, name: recipient.name }).catch(() => ({ status: "failed" }));
      } else {
        notification = { status: "skipped", reason: recipient?.email === process.env.ADMIN_EMAIL ? "admin" : "missing_phone" };
      }
    }
    res.json({ ...rows[0], notification });
  } catch (err) {
    console.error('Review save failed:', err.message);
    res.status(500).json({ error: 'שמירת ההמלצות נכשלה' });
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
