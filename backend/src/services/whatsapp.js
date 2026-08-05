import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import Anthropic from '@anthropic-ai/sdk';
import pool from '../db/pool.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let client = null;
let qrDataUrl = null;
let status = 'disconnected'; // disconnected | qr | connecting | ready

const CATEGORIES = ['דיור', 'אוכל', 'תחבורה', 'עסקי', 'חובות', 'בריאות וביטוח', 'אישי', 'תרומות'];

// מספרים מורשים (מתוך env: WHATSAPP_ALLOWED=972501234567,972521234567)
function getAllowedNumbers() {
  return (process.env.WHATSAPP_ALLOWED || '').split(',').map(n => n.trim()).filter(Boolean);
}

function isAllowed(from, author) {
  const allowed = getAllowedNumbers();
  if (!allowed.length) return true; // אם לא הוגדר — מקבל הכל
  const sender = (author || from).replace('@c.us', '').replace('@g.us', '');
  return allowed.includes(sender);
}

async function parseMessage(text) {
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `אתה מנתח הודעות ווטסאפ עבריות לאפליקציית ניהול תקציב.
הודעה: "${text}"
קטגוריות זמינות: ${CATEGORIES.join(', ')}

אם ההודעה היא עסקה כספית, החזר JSON בלבד:
{"is_financial":true,"type":"expense"|"income","amount":number,"description":"תיאור קצר","category":"קטגוריה מהרשימה (רק להוצאות)"}

אם לא עסקה כספית: {"is_financial":false}

דוגמאות:
"קפה 45" → {"is_financial":true,"type":"expense","amount":45,"description":"קפה","category":"אוכל"}
"דלק 300" → {"is_financial":true,"type":"expense","amount":300,"description":"דלק","category":"תחבורה"}
"הכנסה 8000 משכורת" → {"is_financial":true,"type":"income","amount":8000,"description":"משכורת"}
"מה שלומך" → {"is_financial":false}`
      }]
    });
    const raw = resp.content[0].text.trim();
    const json = raw.match(/\{[\s\S]*\}/)?.[0];
    return json ? JSON.parse(json) : { is_financial: false };
  } catch {
    return { is_financial: false };
  }
}

async function handleMessage(msg) {
  const text = msg.body?.trim();
  if (!text) return;
  if (!isAllowed(msg.from, msg.author)) return;

  const parsed = await parseMessage(text);
  if (!parsed.is_financial) return;

  try {
    // מצא משתמש לפי מספר טלפון
    const senderNum = (msg.author || msg.from).replace('@c.us', '').replace('+', '');
    const { rows: [user] } = await pool.query(
      `SELECT id FROM users WHERE phone=$1 OR phone=$2`,
      [senderNum, '+' + senderNum]
    );

    // fallback — משתמש יחיד במערכת
    const { rows: [fallback] } = await pool.query(`SELECT id FROM users ORDER BY created_at LIMIT 1`);
    const userId = user?.id || fallback?.id;
    if (!userId) { await msg.reply('❌ משתמש לא נמצא במערכת'); return; }

    if (parsed.type === 'expense') {
      const { rows: [cat] } = await pool.query(
        `SELECT id FROM categories WHERE user_id=$1 AND name=$2`,
        [userId, parsed.category]
      );
      await pool.query(
        `INSERT INTO expenses (user_id, category_id, amount, description, expense_date)
         VALUES ($1,$2,$3,$4,CURRENT_DATE)`,
        [userId, cat?.id || null, parsed.amount, parsed.description]
      );
      await msg.reply(
        `✅ הוצאה נרשמה\n💰 ₪${parsed.amount}\n📝 ${parsed.description}\n📁 ${parsed.category || 'ללא קטגוריה'}`
      );
    } else {
      await pool.query(
        `INSERT INTO incomes (user_id, amount, source, description, income_date, payment_method)
         VALUES ($1,$2,$3,$4,CURRENT_DATE,'העברה בנקאית')`,
        [userId, parsed.amount, parsed.description, parsed.description]
      );
      await msg.reply(
        `✅ הכנסה נרשמה\n💰 ₪${parsed.amount}\n📝 ${parsed.description}`
      );
    }
  } catch (err) {
    console.error('WhatsApp handler error:', err.message);
    await msg.reply('❌ שגיאה בשמירה, נסה שוב');
  }
}

export function getStatus() { return { status, hasQr: !!qrDataUrl }; }
export function getQrDataUrl() { return qrDataUrl; }

export function initWhatsApp() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠️  WhatsApp: ANTHROPIC_API_KEY חסר — בוט לא יופעל');
    return;
  }

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: '/app/whatsapp-session' }),
    puppeteer: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    },
  });

  client.on('qr', async (qr) => {
    status = 'qr';
    qrDataUrl = await qrcode.toDataURL(qr);
    console.log('📱 WhatsApp QR מוכן — פתח /api/whatsapp/qr לסריקה');
  });

  client.on('ready', () => {
    status = 'ready';
    qrDataUrl = null;
    console.log('✅ WhatsApp מחובר');
  });

  client.on('disconnected', () => {
    status = 'disconnected';
    console.log('⚠️  WhatsApp התנתק');
  });

  client.on('message', handleMessage);

  client.initialize().catch(err => console.error('WhatsApp init error:', err.message));
}
