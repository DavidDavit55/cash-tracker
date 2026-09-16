import { Router } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import { verifyService, toE164 } from '../lib/twilioVerify.js';

const router = Router();

const DEFAULT_CATEGORIES = [
  { name: 'מזון וסופר', icon: '🛒', color: '#22c55e' },
  { name: 'מסעדות ובתי קפה', icon: '🍽️', color: '#f97316' },
  { name: 'תחבורה', icon: '🚗', color: '#3b82f6' },
  { name: 'קניות ובגדים', icon: '👕', color: '#a855f7' },
  { name: 'בריאות ורפואה', icon: '💊', color: '#ef4444' },
  { name: 'בידור ופנאי', icon: '🎮', color: '#eab308' },
  { name: 'חינוך', icon: '📚', color: '#06b6d4' },
  { name: 'שונות', icon: '📦', color: '#6b7280' },
];

router.post('/register', async (req, res) => {
  const { email, name, phone } = req.body;
  if (!email || !name || !phone) return res.status(400).json({ error: 'שדות חסרים' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM users WHERE email=$1 OR phone=$2', [email, phone]);
    if (existing.rows.length) return res.status(409).json({ error: 'המייל או הטלפון כבר קיימים' });

    const { rows } = await client.query(
      'INSERT INTO users (email, name, phone) VALUES ($1,$2,$3) RETURNING id,email,name,phone',
      [email, name, phone]
    );
    const user = rows[0];

    // Insert default categories
    for (const cat of DEFAULT_CATEGORIES) {
      await client.query(
        'INSERT INTO categories (user_id, name, icon, color, is_default) VALUES ($1,$2,$3,$4,true)',
        [user.id, cat.name, cat.icon, cat.color]
      );
    }

    await client.query('COMMIT');
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  } finally {
    client.release();
  }
});

// התחברות ב-2 שלבים: שולחים קוד ב-SMS למספר, ואז מאמתים אותו - אין סיסמה בכלל.
router.post('/login/send', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'חסר מספר טלפון' });
  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE phone=$1', [phone]);
    if (!rows.length) return res.status(404).json({ error: 'מספר טלפון לא נמצא' });
    await verifyService().verifications.create({ to: toE164(phone), channel: 'sms' });
    res.json({ sent: true });
  } catch (err) {
    console.error('Twilio send error:', err.message);
    res.status(500).json({ error: 'שליחת הקוד נכשלה' });
  }
});

router.post('/login/check', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'חסרים שדות' });
  try {
    const check = await verifyService().verificationChecks.create({ to: toE164(phone), code });
    if (check.status !== 'approved') return res.status(400).json({ error: 'קוד שגוי' });

    const { rows } = await pool.query('SELECT id,email,name FROM users WHERE phone=$1', [phone]);
    if (!rows.length) return res.status(404).json({ error: 'מספר טלפון לא נמצא' });
    const user = rows[0];

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    console.error('Twilio check error:', err.message);
    res.status(400).json({ error: 'קוד שגוי או פג תוקף' });
  }
});

router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query('SELECT id,email,name FROM users WHERE id=$1', [payload.id]);
    res.json(rows[0]);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
