import { Router } from 'express';
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM categories WHERE user_id=$1 ORDER BY is_default DESC, name',
    [req.user.id]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, icon, color } = req.body;
  if (!name) return res.status(400).json({ error: 'שם חסר' });
  const { rows } = await pool.query(
    'INSERT INTO categories (user_id, name, icon, color) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.user.id, name, icon || '📦', color || '#6b7280']
  );
  res.json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { name, icon, color } = req.body;
  const { rows } = await pool.query(
    'UPDATE categories SET name=$1, icon=$2, color=$3 WHERE id=$4 AND user_id=$5 RETURNING *',
    [name, icon, color, req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'לא נמצא' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM categories WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

export default router;
