import { Router } from 'express';
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { month, year } = req.query;
  const m = month || new Date().getMonth() + 1;
  const y = year || new Date().getFullYear();

  const { rows: budgeted } = await pool.query(
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

  // קטגוריות עם הוצאות אבל ללא תקציב מוגדר
  const budgetedCatIds = budgeted.map(b => b.category_id);
  const { rows: unbudgeted } = await pool.query(
    `SELECT c.id as category_id, c.name as category_name, c.icon, c.color,
            SUM(e.amount) as spent, 0 as amount, NULL as id,
            $2::int as month, $3::int as year
     FROM expenses e
     JOIN categories c ON e.category_id = c.id
     WHERE e.user_id=$1
       AND EXTRACT(MONTH FROM e.expense_date)=$2
       AND EXTRACT(YEAR FROM e.expense_date)=$3
       ${budgetedCatIds.length ? `AND e.category_id NOT IN (${budgetedCatIds.map((_,i) => `$${i+4}`).join(',')})` : ''}
     GROUP BY c.id, c.name, c.icon, c.color
     ORDER BY spent DESC`,
    [req.user.id, m, y, ...budgetedCatIds]
  );

  res.json([...budgeted, ...unbudgeted.map(r => ({ ...r, no_budget: true }))]);
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

router.put('/:id', async (req, res) => {
  const { amount } = req.body;
  const { rows } = await pool.query(
    'UPDATE budgets SET amount=$1 WHERE id=$2 AND user_id=$3 RETURNING *',
    [amount, req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'לא נמצא' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM budgets WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ success: true });
});

export default router;
