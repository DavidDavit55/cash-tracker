import { Router } from 'express';
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

function requireAdmin(req, res, next) {
  if (!process.env.ADMIN_EMAIL || req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: 'אין הרשאה' });
  }
  next();
}

router.get('/clients', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, cp.phone, cp.status, cp.created_at
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

export default router;
