import { Router } from 'express';
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';
import { verifyService, toE164 } from '../lib/twilioVerify.js';

const router = Router();

router.post('/send', authMiddleware, async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'חסר מספר טלפון' });
  try {
    await verifyService().verifications.create({ to: toE164(phone), channel: 'sms' });
    res.json({ sent: true });
  } catch (err) {
    console.error('Twilio send error:', err.message);
    res.status(500).json({ error: 'שליחת הקוד נכשלה' });
  }
});

router.post('/check', authMiddleware, async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'חסרים שדות' });
  try {
    const check = await verifyService().verificationChecks.create({ to: toE164(phone), code });
    if (check.status !== 'approved') return res.status(400).json({ error: 'קוד שגוי' });
    await pool.query('UPDATE users SET phone_verified=true WHERE id=$1', [req.user.id]);
    res.json({ verified: true });
  } catch (err) {
    console.error('Twilio check error:', err.message);
    res.status(400).json({ error: 'קוד שגוי או פג תוקף' });
  }
});

export default router;
