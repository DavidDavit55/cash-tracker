import { Router } from 'express';
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';
import { notifyNewClient } from '../services/whatsapp.js';
import { sendNewClientEmail } from '../services/email.js';
import { isValidIsraeliId } from '../lib/israeliId.js';

const router = Router();

router.post('/', authMiddleware, async (req, res) => {
  const {
    phone, id_number, birth_date, id_issue_date,
    risk_tolerance, investment_horizon, financial_knowledge, goals, life_stage,
  } = req.body;

  if (!phone || !id_number || !birth_date) {
    return res.status(400).json({ error: 'שדות חסרים' });
  }
  if (!isValidIsraeliId(id_number)) {
    return res.status(400).json({ error: 'תעודת זהות לא תקינה' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO client_profiles
         (user_id, phone, id_number, birth_date, id_issue_date, risk_tolerance, investment_horizon, financial_knowledge, goals, life_stage)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (user_id) DO UPDATE SET
         phone=$2, id_number=$3, birth_date=$4, id_issue_date=$5,
         risk_tolerance=$6, investment_horizon=$7, financial_knowledge=$8, goals=$9, life_stage=$10
       RETURNING *`,
      [req.user.id, phone, id_number, birth_date, id_issue_date || null,
        risk_tolerance, investment_horizon, financial_knowledge, goals, life_stage]
    );

    const { rows: [u] } = await pool.query('SELECT name, email FROM users WHERE id=$1', [req.user.id]);
    notifyNewClient({ name: u?.name, phone }).catch(() => {});
    sendNewClientEmail({ name: u?.name, phone, email: u?.email }).catch(() => {});

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM client_profiles WHERE user_id=$1', [req.user.id]);
    res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/financial-data', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT pension_data, insurance_data, client_info FROM client_financial_data WHERE user_id=$1',
      [req.user.id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;
