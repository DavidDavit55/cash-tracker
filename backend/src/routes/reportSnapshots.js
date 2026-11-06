import { Router } from 'express';
import multer from 'multer';
import { createHash } from 'node:crypto';
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateReport } from '../services/reportSnapshots.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, fieldSize: 3 * 1024 * 1024, files: 1, fields: 1 } });
router.use(authMiddleware, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!process.env.ADMIN_EMAIL || req.user.email !== process.env.ADMIN_EMAIL) return res.status(403).json({ error: 'אין הרשאה' });
  next();
});
router.param('clientId', (req, res, next, id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? next() : res.status(400).json({ error: 'מזהה לקוח לא תקין' }));
router.param('reportId', (req, res, next, id) => /^[0-9a-f-]{36}$/i.test(id) ? next() : res.status(400).json({ error: 'מזהה דוח לא תקין' }));

router.get('/:clientId/reports', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT id, source, as_of_date::text, issued_on::text, received_at, filename, payload
      FROM client_report_snapshots WHERE user_id=$1 ORDER BY as_of_date DESC, received_at DESC`, [req.params.clientId]);
    res.json(rows);
  } catch (error) { next(error); }
});

router.post('/:clientId/reports', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'חסר קובץ מקור' });
    let report;
    try { report = JSON.parse(req.body.report); } catch { return res.status(400).json({ error: 'דוח לא תקין' }); }
    const { rows: [client] } = await pool.query('SELECT id_number FROM client_profiles WHERE user_id=$1', [req.params.clientId]);
    if (!client) return res.status(404).json({ error: 'לא נמצא לקוח' });
    let payload;
    try { payload = validateReport(report, client.id_number); } catch (error) { return res.status(400).json({ error: error.message }); }
    const extension = report.source === 'maslaka' ? /\.(zip|xml)$/i : /\.(xlsx|xls)$/i;
    if (!extension.test(req.file.originalname)) return res.status(400).json({ error: 'סוג קובץ לא מתאים למקור' });
    const hash = createHash('sha256').update(req.file.buffer).digest('hex');
    // One atomic insert preserves both source bytes and the parsed snapshot; never writes live data.
    const { rows } = await pool.query(`INSERT INTO client_report_snapshots
      (user_id, source, as_of_date, issued_on, created_by, filename, file_data, content_hash, payload)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (user_id, source, content_hash) DO NOTHING
      RETURNING id, received_at`, [req.params.clientId, report.source, report.asOfDate, report.issuedOn || null,
      req.user.id, req.file.originalname, req.file.buffer, hash, JSON.stringify(payload)]);
    if (!rows.length) return res.status(409).json({ error: 'הקובץ הזה כבר נשמר בהיסטוריית הלקוח' });
    res.status(201).json(rows[0]);
  } catch (error) { next(error); }
});

router.get('/:clientId/reports/:reportId/file', async (req, res, next) => {
  try {
    const { rows: [report] } = await pool.query('SELECT filename, file_data FROM client_report_snapshots WHERE user_id=$1 AND id=$2', [req.params.clientId, req.params.reportId]);
    if (!report) return res.status(404).json({ error: 'דוח לא נמצא' });
    res.set('Content-Type', 'application/octet-stream');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(report.filename)}`);
    res.send(report.file_data);
  } catch (error) { next(error); }
});
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ error: 'הקובץ או הדוח גדולים מדי. מגבלת הקובץ היא 20MB.' });
  console.error('Report snapshot failed:', error.code || 'unknown');
  res.status(500).json({ error: 'לא ניתן לשמור או לטעון דוח. נסה שוב.' });
});
export default router;
