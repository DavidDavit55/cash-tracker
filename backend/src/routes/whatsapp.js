import { Router } from 'express';
import { getStatus, getQrDataUrl } from '../services/whatsapp.js';

const router = Router();

// GET /api/whatsapp/status
router.get('/status', (req, res) => {
  res.json(getStatus());
});

// GET /api/whatsapp/qr — דף HTML עם QR לסריקה
router.get('/qr', (req, res) => {
  const qr = getQrDataUrl();
  const { status } = getStatus();

  if (status === 'ready') {
    return res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:40px">
      <h2>✅ WhatsApp מחובר ופעיל!</h2>
    </body></html>`);
  }

  if (!qr) {
    return res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:40px">
      <h2>⏳ ממתין לאתחול...</h2>
      <p>רענן את הדף בעוד כמה שניות</p>
      <script>setTimeout(()=>location.reload(),3000)</script>
    </body></html>`);
  }

  res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#f8fafc">
    <h2>סרוק עם הטלפון המיותר</h2>
    <p style="color:#64748b">פתח ווטסאפ ← תפריט ← מכשירים מקושרים ← קשר מכשיר</p>
    <img src="${qr}" style="width:280px;height:280px;border:1px solid #e2e8f0;border-radius:12px"/>
    <p style="color:#94a3b8;font-size:0.85rem">הדף מתרענן אוטומטית...</p>
    <script>setTimeout(()=>location.reload(),5000)</script>
  </body></html>`);
});

export default router;
