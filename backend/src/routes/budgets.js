import { Router } from 'express';
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { month, year } = req.query;
  const m = month || new Date().getMonth() + 1;
  const y = year || new Date().getFullYear();

  const { rows } = await pool.query(
    `SELECT b.*, c.name as category_name, c.icon, c.color,
      COALESCE((
        SELECT SUM(amount) FROM expenses
        WHERE user_id=$1 AND category_id=b.category_id
        AND EXTRACT(MONTH FROM expense_date)=$2 AND EXTRACT(YEAR FROM expense_date)=$3
      ), 0) as spent
     FROM budgets b JOIN categories c ON b.category_id=c.id
     WHERE b.user_id=$1 AND b.month=$2 AND b.year=$3`,
    [req.user.id, m, y]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { category_id, amount, month, year } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO budgets (user_id, category_id, amount, month, year)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, category_id, month, year) DO UPDATE SET amount=$3
     RETURNING *`,
    [req.user.id, category_id, amount, month, year]
  );
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM budgets WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

export default router;
