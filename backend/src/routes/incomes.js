import { Router } from 'express';
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /incomes
router.get('/', async (req, res) => {
  const { month, year } = req.query;
  let query = `SELECT * FROM incomes WHERE user_id=$1`;
  const params = [req.user.id];
  if (month && year) {
    params.push(month, year);
    query += ` AND EXTRACT(MONTH FROM income_date)=$${params.length - 1} AND EXTRACT(YEAR FROM income_date)=$${params.length}`;
  }
  query += ` ORDER BY income_date DESC, created_at DESC`;
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// GET /incomes/stats/summary
router.get('/stats/summary', async (req, res) => {
  const { month, year } = req.query;
  const m = month || new Date().getMonth() + 1;
  const y = year || new Date().getFullYear();
  try {
    const { rows: bySource } = await pool.query(
      `SELECT source, payment_method, SUM(amount) as total, COUNT(*) as count
       FROM incomes WHERE user_id=$1 AND EXTRACT(MONTH FROM income_date)=$2 AND EXTRACT(YEAR FROM income_date)=$3
       GROUP BY source, payment_method ORDER BY total DESC`,
      [req.user.id, m, y]
    );
    const { rows: total } = await pool.query(
      `SELECT SUM(amount) as total, COUNT(*) as count FROM incomes
       WHERE user_id=$1 AND EXTRACT(MONTH FROM income_date)=$2 AND EXTRACT(YEAR FROM income_date)=$3`,
      [req.user.id, m, y]
    );
    const { rows: monthly } = await pool.query(
      `SELECT EXTRACT(MONTH FROM income_date) as month, EXTRACT(YEAR FROM income_date) as year, SUM(amount) as total
       FROM incomes WHERE user_id=$1 AND income_date >= NOW() - INTERVAL '12 months'
       GROUP BY month, year ORDER BY year, month`,
      [req.user.id]
    );
    res.json({ bySource, total: total[0], monthly });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// POST /incomes
router.post('/', async (req, res) => {
  const { amount, source, description, income_date, payment_method, notes } = req.body;
  if (!amount) return res.status(400).json({ error: 'סכום חסר' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO incomes (user_id, amount, source, description, income_date, payment_method, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, amount, source || null, description || null,
       income_date || new Date().toISOString().split('T')[0],
       payment_method || 'העברה בנקאית', notes || null]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// PUT /incomes/:id
router.put('/:id', async (req, res) => {
  const { amount, source, description, income_date, payment_method, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE incomes SET amount=$1, source=$2, description=$3, income_date=$4, payment_method=$5, notes=$6, updated_at=NOW()
       WHERE id=$7 AND user_id=$8 RETURNING *`,
      [amount, source, description, income_date, payment_method, notes, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'לא נמצא' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// DELETE /incomes/:id
router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query(
    'DELETE FROM incomes WHERE id=$1 AND user_id=$2 RETURNING id',
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'לא נמצא' });
  res.json({ success: true });
});

export default router;
