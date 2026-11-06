import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONSENT_ITEMS, CONSENT_VERSION, buildConsentText } from './consents.mjs';
import { isValidIsraeliId, normalizeIsraeliId } from '../src/lib/israeliId.js';

const phoneOf = value => {
  const digits = String(value || '').replace(/[\s()-]/g, '');
  const phone = digits.startsWith('0') ? '+972' + digits.slice(1) : digits.startsWith('972') ? '+' + digits : digits;
  if (!/^\+9725\d{8}$/.test(phone)) throw new Error('יש להזין מספר נייד ישראלי תקין');
  return phone;
};
export function workflow({ directory, env = process.env, transport = fetch } = {}) {
  const dir = directory || resolve('frontend/.sandbox-state');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = resolve(dir, 'workflow.json');
  const db = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { clients: [], messages: [], admin: null };
  const sessionFile = resolve(dir, 'sessions.json');
  const tokenKey = token => createHash('sha256').update(token).digest('hex');
  const sessions = new Map(existsSync(sessionFile) ? JSON.parse(readFileSync(sessionFile, 'utf8')).filter(([, value]) => value.expires > Date.now()) : []);
  const saveSessions = () => { writeFileSync(sessionFile + '.tmp', JSON.stringify([...sessions]), { mode: 0o600 }); renameSync(sessionFile + '.tmp', sessionFile); };
  const save = () => { writeFileSync(file + '.tmp', JSON.stringify(db), { mode: 0o600 }); renameSync(file + '.tmp', file); };
  const ready = () => ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER', 'ADMIN_WHATSAPP_NUMBER', 'TWILIO_CONTENT_SID_WELCOME', 'TWILIO_CONTENT_SID_LEAD_ALERT', 'TWILIO_CONTENT_SID_RECOMMENDATIONS'].map(name => ({ name, ready: Boolean(env[name]) }));
  const auth = () => 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
  async function twilio(url, body) {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) throw new Error('חיבור Twilio טרם הוגדר');
    const response = await transport(url, { method: body ? 'POST' : 'GET', headers: { Authorization: auth(), ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body: body ? new URLSearchParams(body) : undefined, signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    if (!response.ok) throw new Error(`Twilio: ${data.code || response.status}`);
    return data;
  }
  function session(role, phone) { const token = randomBytes(32).toString('hex'); sessions.set(tokenKey(token), { role, phone, expires: Date.now() + 8 * 3600000 }); saveSessions(); return token; }
  async function notify(client, kind, version = '') {
    if (kind !== 'admin' && client.whatsappConsent !== true) return;
    const key = `${client.id}:${kind}:${version}`;
    // Persist before sending. Uncertain sends are not retried automatically.
    if (db.messages.some(m => m.key === key)) return;
    const admin = kind === 'admin';
    const setting = { admin: 'TWILIO_CONTENT_SID_LEAD_ALERT', welcome: 'TWILIO_CONTENT_SID_WELCOME', data: 'TWILIO_CONTENT_SID_RECOMMENDATIONS' }[kind];
    const message = { id: randomUUID(), key, clientId: client.id, kind, status: 'pending', at: new Date().toISOString() };
    db.messages.push(message); save();
    try {
      if (!env[setting] || !env.TWILIO_WHATSAPP_NUMBER || (admin && !env.ADMIN_WHATSAPP_NUMBER)) throw new Error('חסרה הגדרת תבנית או מספר שולח');
      const result = await twilio(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        From: `whatsapp:${phoneOf(env.TWILIO_WHATSAPP_NUMBER)}`, To: `whatsapp:${admin ? phoneOf(env.ADMIN_WHATSAPP_NUMBER) : client.phone}`,
        ContentSid: env[setting], ContentVariables: JSON.stringify(admin ? { 1: client.name, 2: client.phone } : { 1: client.name }),
      });
      Object.assign(message, { sid: result.sid, status: result.status, error: result.error_code || null });
    } catch (e) { Object.assign(message, { status: 'unconfirmed', error: e.message }); }
    save();
  }
  return async (req, res, next) => {
    if (!req.url.startsWith('/sandbox-workflow/')) return next();
    const send = (status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(data)); };
    const origin = req.headers.origin;
    if (!['127.0.0.1:5175', 'localhost:5175'].includes(req.headers.host) || req.headers['sec-fetch-site'] === 'cross-site' || (origin && !['http://127.0.0.1:5175', 'http://localhost:5175'].includes(origin))) return send(403, { error: 'גישה מקומית בלבד' });
    if (req.method !== 'GET' && !origin) return send(403, { error: 'נדרש מקור מקומי' });
    try {
      let body = {};
      if (req.method !== 'GET') { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > 12 * 1024 * 1024) throw new Error('קובץ גדול מדי'); chunks.push(chunk); } body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
      const path = new URL(req.url, 'http://localhost').pathname.slice('/sandbox-workflow'.length);
      const current = sessions.get(tokenKey(String(req.headers.authorization || '').replace(/^Bearer /, '')));
      const requireRole = role => { if (!current || current.expires < Date.now() || current.role !== role) { const e = new Error('נדרשת התחברות'); e.status = 401; throw e; } };
      if (path === '/status' && req.method === 'GET') return send(200, { adminConfigured: Boolean(env.ADMIN_WHATSAPP_NUMBER), messagingReady: ready().every(v => v.ready), localOnly: true });
      if (path === '/resume-client' && req.method === 'POST') {
        const permit = resolve(dir, 'resume-client.once');
        if (!existsSync(permit)) throw new Error('קישור ההמשך כבר נוצל');
        const grant = JSON.parse(readFileSync(permit, 'utf8'));
        if (grant.expires < Date.now() || tokenKey(String(body.key || '')) !== grant.hash) throw new Error('קישור המשך לא תקין');
        const phone = phoneOf(env.ADMIN_WHATSAPP_NUMBER);
        unlinkSync(permit);
        return send(200, { token: session(grant.role === 'admin' ? 'admin' : 'client', phone), phone });
      }
      if (path === '/admin/from-client' && req.method === 'POST') {
        requireRole('client');
        if (!env.ADMIN_WHATSAPP_NUMBER || current.phone !== phoneOf(env.ADMIN_WHATSAPP_NUMBER)) return send(403, { error: 'המספר המחובר אינו מורשה לאדמין' });
        return send(200, { token: session('admin', current.phone) });
      }
      // Local Vite sandbox only: never contacts Verify or changes production authentication.
      if (path === '/local-login' && req.method === 'POST') {
        const phone = phoneOf(body.phone);
        if (body.role && !['admin', 'client'].includes(body.role)) throw new Error('סוג כניסה לא תקין');
        const role = body.role === 'admin' ? 'admin' : 'client';
        if (role === 'admin' && (!env.ADMIN_WHATSAPP_NUMBER || phone !== phoneOf(env.ADMIN_WHATSAPP_NUMBER))) throw new Error('המספר אינו מורשה לכניסת אדמין');
        return send(200, { token: session(role, phone), phone });
      }
      if (path.startsWith('/otp/')) return send(410, { error: 'אימות SMS כבוי בסנדבוקס. יש להיכנס באמצעות מספר הטלפון.' });
      if (path === '/me' && req.method === 'GET') { requireRole('client'); const found = db.clients.find(c => c.phone === current.phone); const { reviewDraft, ...visible } = found || {}; return send(200, { client: found ? visible : null }); }
      if (path === '/register' && req.method === 'POST') {
        requireRole('client');
        const existing = db.clients.find(c => c.phone === current.phone);
        if (existing) { const visible = { ...existing }; delete visible.reviewDraft; return send(200, { client: visible }); }
        if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 120) throw new Error('יש להזין שם מלא תקין');
        if (!isValidIsraeliId(body.id_number)) throw new Error('תעודת הזהות אינה תקינה. יש לחזור לפרטים האישיים ולבדוק את הספרות.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.birth_date || '') || !Number.isFinite(Date.parse(body.birth_date)) || new Date(body.birth_date) >= new Date()) throw new Error('תאריך הלידה אינו תקין. יש לחזור לפרטים האישיים ולהזין תאריך בעבר.');
        if (db.clients.some(c => c.id_number === normalizeIsraeliId(body.id_number))) throw new Error('קיים תיק עם תעודת הזהות הזו');
        if (CONSENT_ITEMS.some(item => body.consents?.[item.key] !== true) || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(body.signature || '') || body.signature.length < 300 || body.signature.length > 1000000) throw new Error('יש להשלים אישורים וחתימה');
        const client = { id: randomUUID(), phone: current.phone, name: body.name.trim(), id_number: normalizeIsraeliId(body.id_number), birth_date: body.birth_date, id_issue_date: body.id_issue_date || '', marital_status: body.marital_status || '', goals: body.goals || '', risk_tolerance: body.risk_tolerance || '', signedAt: new Date().toISOString(), consentVersion: CONSENT_VERSION, consents: CONSENT_ITEMS.map(item => ({ key: item.key, title: item.title, text: buildConsentText(item.key, body.name.trim(), normalizeIsraeliId(body.id_number)), accepted: true })), whatsappConsent: body.whatsappConsent === true, signature: body.signature, financial: null };
        db.clients.push(client); save();
        void Promise.all([notify(client, 'welcome'), notify(client, 'admin')]);
        return send(201, { client });
      }
      requireRole('admin');
      if (path === '/admin/clients' && req.method === 'GET') return send(200, { clients: db.clients, messages: db.messages, configuration: ready() });
      const reviewRoute = path.match(/^\/admin\/clients\/([a-f0-9-]+)\/review$/);
      if (reviewRoute && req.method === 'POST') {
        const client = db.clients.find(c => c.id === reviewRoute[1]);
        if (!client?.financial) throw new Error('יש לטעון נתוני תיק לפני כתיבת המלצות');
        if (!body.version || body.version !== client.updatedAt) return send(409, { error: 'נתוני התיק השתנו. יש לרענן ולבדוק אותם לפני פרסום.' });
        if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 20000 || typeof body.agentName !== 'string' || !body.agentName.trim() || body.agentName.length > 120) throw new Error('יש למלא שם סוכן והמלצות');
        client.reviewDraft = { text: body.text.trim(), agentName: body.agentName.trim(), dataVersion: client.updatedAt, savedAt: new Date().toISOString() };
        if (body.publish === true) client.review = { ...client.reviewDraft, publishedAt: new Date().toISOString() };
        save(); return send(200, { saved: true, published: body.publish === true });
      }
      const upload = path.match(/^\/admin\/clients\/([a-f0-9-]+)\/data$/);
      if (upload && req.method === 'POST') {
        const client = db.clients.find(c => c.id === upload[1]); if (!client) throw new Error('לקוח לא נמצא');
        const data = body.snapshot;
        if (!data || normalizeIsraeliId(data.client_info?.id) !== client.id_number) throw new Error('תעודת הזהות בקבצים אינה תואמת ללקוח');
        if (!['pension_data', 'insurance_data', 'har_bituach_data'].every(k => Array.isArray(data[k])) || ![...data.pension_data, ...data.insurance_data, ...data.har_bituach_data].length) throw new Error('לא נמצאו מוצרים לשמירה');
        const financial = { pension_data: data.pension_data, insurance_data: data.insurance_data, har_bituach_data: data.har_bituach_data, client_info: data.client_info };
        const version = createHash('sha256').update(JSON.stringify(financial)).digest('hex');
        if (JSON.stringify(client.financial) !== JSON.stringify(financial)) { delete client.review; delete client.reviewDraft; client.financial = financial; client.updatedAt = new Date().toISOString(); } save();
        if (body.notify === true) void notify(client, 'data', version);
        return send(200, { saved: true });
      }
      if (path === '/admin/messages/refresh' && req.method === 'POST') {
        for (const message of db.messages.filter(m => m.sid && !['delivered', 'read', 'failed', 'undelivered'].includes(m.status))) {
          try { const result = await twilio(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages/${message.sid}.json`); Object.assign(message, { status: result.status, error: result.error_code || null }); } catch { /* Keep the last confirmed state. */ }
        }
        save(); return send(200, { messages: db.messages });
      }
      return send(404, { error: 'פעולה לא קיימת' });
    } catch (error) { return send(error.status || 400, { error: error.message }); }
  };
}
export function workflowPlugin(directory) {
  return { name: 'networth-local-workflow', configureServer(server) { server.middlewares.use(workflow({ directory })); } };
}
