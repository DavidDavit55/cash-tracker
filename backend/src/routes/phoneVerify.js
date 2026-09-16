import { Router } from 'express';
import twilio from 'twilio';
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

function verifyService() {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID);
}

// מספר ישראלי מקומי (05X-XXXXXXX) ל-E.164 (+9725XXXXXXXX) - Twilio Verify דורש E.164.
function toE164(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('972')) return '+' + digits;
  if (digits.startsWith('0')) return '+972' + digits.slice(1);
  return '+' + digits;
}

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
