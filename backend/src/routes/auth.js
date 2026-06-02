import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';

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
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'שדות חסרים' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'המייל כבר קיים' });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await client.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id,email,name',
      [email, hash, name]
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

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'מייל או סיסמה שגויים' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'מייל או סיסמה שגויים' });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
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
