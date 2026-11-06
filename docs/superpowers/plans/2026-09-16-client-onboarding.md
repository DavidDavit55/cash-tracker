# Client Onboarding + Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a client self-register (account + ID details + 5-question risk questionnaire), notify David by WhatsApp when they finish, and give David a `/admin/clients` list of everyone who registered.

**Architecture:** Extend the existing Node/Express + Postgres backend with one new table (`client_profiles`, linked to the existing `users` table) and two new route files. Extend the existing React frontend's `Register.jsx` into a 3-step wizard, and add a new admin-only page. Reuse the already-running WhatsApp bot connection to send the notification — no new external service.

**Tech Stack:** Node/Express, Postgres (`pg`), React 19 + react-router, axios, whatsapp-web.js (already wired up).

**Spec:** `docs/superpowers/specs/2026-09-16-client-onboarding-design.md`

## Global Constraints

- No automated test framework exists anywhere in this repo (no jest/mocha/vitest configured in either `backend/package.json` or `frontend/package.json`). Do not introduce one for this feature. Every task's verification step is a manual `curl` command or a manual browser check instead of an automated test — this matches how the rest of the codebase is verified today.
- Do not modify the existing `users` table or the existing `/api/auth/*` endpoints' request/response shape — other parts of the app (and the existing cash-tracker frontend) depend on them unchanged.
- All new Hebrew user-facing strings follow the existing RTL/Hebrew convention already used throughout the app (see `frontend/src/pages/Register.jsx`, `frontend/src/index.css` `.form-group`/`.btn-primary`/`.auth-*` classes — reuse those classes, don't invent new ones).
- `client_profiles.user_id` has a `UNIQUE` constraint — one profile per user. The insert step uses `ON CONFLICT (user_id) DO UPDATE` so re-submitting the wizard (e.g. after a network error) never creates duplicates.

---

## File Structure

- **Modify** `backend/src/db/schema.sql` — add `client_profiles` table (idempotent `CREATE TABLE IF NOT EXISTS`, runs on every boot like the rest of the schema).
- **Create** `backend/src/routes/clientProfile.js` — `POST /api/client-profile` (create/update the logged-in user's profile, triggers WhatsApp notify), `GET /api/client-profile` (fetch the logged-in user's own profile).
- **Create** `backend/src/routes/admin.js` — `GET /api/admin/clients` (list all client profiles, gated on `req.user.email === process.env.ADMIN_EMAIL`).
- **Modify** `backend/src/services/whatsapp.js` — add and export `notifyNewClient({ name, phone })`.
- **Modify** `backend/src/index.js` — mount the two new route files.
- **Modify** `backend/.env.example` — document `ADMIN_EMAIL` and `ADMIN_WHATSAPP_NUMBER`.
- **Modify** `frontend/src/pages/Register.jsx` — turn into a 3-step wizard (account → ID details → questionnaire).
- **Create** `frontend/src/pages/AdminClients.jsx` — admin-only client list page.
- **Modify** `frontend/src/App.jsx` — add the `/admin/clients` route.
- **Modify** `frontend/src/components/Layout.jsx` — add a drawer link to `/admin/clients`, shown only when the logged-in user's email matches `import.meta.env.VITE_ADMIN_EMAIL`.
- **Modify** `frontend/.env.example` — document `VITE_ADMIN_EMAIL`.

---

### Task 1: `client_profiles` table

**Files:**
- Modify: `backend/src/db/schema.sql`

**Interfaces:**
- Produces: table `client_profiles(id, user_id, phone, id_number, birth_date, id_issue_date, risk_tolerance, investment_horizon, financial_knowledge, goals, life_stage, status, created_at)`, `UNIQUE(user_id)`, `user_id` FK → `users(id) ON DELETE CASCADE`.

- [ ] **Step 1: Add the table to schema.sql**

Append to the end of `backend/src/db/schema.sql`:

```sql
-- פרופיל לקוח NETWORTH (רישום עצמי + שאלון)
CREATE TABLE IF NOT EXISTS client_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  phone VARCHAR(20),
  id_number VARCHAR(20),
  birth_date DATE,
  id_issue_date DATE,
  risk_tolerance VARCHAR(50),
  investment_horizon VARCHAR(50),
  financial_knowledge VARCHAR(50),
  goals VARCHAR(50),
  life_stage VARCHAR(50),
  status VARCHAR(30) DEFAULT 'ממתין למשיכת מסלקה',
  created_at TIMESTAMP DEFAULT NOW()
);
```

- [ ] **Step 2: Verify the table is created**

Start the backend locally (`cd backend && npm run dev`) and run:

```bash
psql "$DATABASE_URL" -c "\d client_profiles"
```

Expected: column list matching the CREATE TABLE above, with the `client_profiles_user_id_key` unique index shown.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/schema.sql
git commit -m "feat: add client_profiles table for NETWORTH onboarding"
```

---

### Task 2: WhatsApp notify function

**Files:**
- Modify: `backend/src/services/whatsapp.js`

**Interfaces:**
- Consumes: module-level `client` (whatsapp-web.js `Client` instance) and `status` string, already defined in this file.
- Produces: `export async function notifyNewClient({ name, phone })` — sends a WhatsApp message to `process.env.ADMIN_WHATSAPP_NUMBER` if the bot is connected; no-ops (logs and returns) if not connected or the env var is missing. Never throws — callers can fire-and-forget.

- [ ] **Step 1: Add the function**

In `backend/src/services/whatsapp.js`, add near the other exported functions (after `getQrDataUrl`):

```js
export async function notifyNewClient({ name, phone }) {
  const target = process.env.ADMIN_WHATSAPP_NUMBER;
  if (!target) {
    console.log('⚠️  ADMIN_WHATSAPP_NUMBER לא מוגדר — לא נשלחה התראה');
    return;
  }
  if (!client || status !== 'ready') {
    console.log('⚠️  WhatsApp לא מחובר — לא נשלחה התראת לקוח חדש');
    return;
  }
  const chatId = target.replace(/\D/g, '') + '@c.us';
  const text = `📋 לקוח חדש נרשם ב-NETWORTH\nשם: ${name || 'לא ידוע'}\nטלפון: ${phone || 'לא צוין'}`;
  try {
    await client.sendMessage(chatId, text);
  } catch (err) {
    console.error('WhatsApp notify failed:', err.message);
  }
}
```

- [ ] **Step 2: Verify it doesn't crash when disconnected**

With the backend running and `ADMIN_WHATSAPP_NUMBER` unset, open a Node REPL against the running process is overkill — instead just confirm via `grep` that the function is exported and doesn't reference anything undefined:

```bash
node --check backend/src/services/whatsapp.js
```

Expected: no output (syntax OK). This step exists to catch typos before Task 3 wires it in.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/whatsapp.js
git commit -m "feat: add notifyNewClient to whatsapp service"
```

---

### Task 3: `POST /api/client-profile` + `GET /api/client-profile`

**Files:**
- Create: `backend/src/routes/clientProfile.js`
- Modify: `backend/src/index.js`

**Interfaces:**
- Consumes: `authMiddleware` from `backend/src/middleware/auth.js` (sets `req.user = { id, email }`); `notifyNewClient` from Task 2.
- Produces: `POST /api/client-profile` body `{ phone, id_number, birth_date, id_issue_date, risk_tolerance, investment_horizon, financial_knowledge, goals, life_stage }` → 200 with the created/updated row, or 400 if `phone`/`id_number`/`birth_date` missing. `GET /api/client-profile` → the caller's own row, or `null`.

- [ ] **Step 1: Create the route file**

Create `backend/src/routes/clientProfile.js`:

```js
import { Router } from 'express';
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';
import { notifyNewClient } from '../services/whatsapp.js';

const router = Router();

router.post('/', authMiddleware, async (req, res) => {
  const {
    phone, id_number, birth_date, id_issue_date,
    risk_tolerance, investment_horizon, financial_knowledge, goals, life_stage,
  } = req.body;

  if (!phone || !id_number || !birth_date) {
    return res.status(400).json({ error: 'שדות חסרים' });
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

    const { rows: [u] } = await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
    notifyNewClient({ name: u?.name, phone }).catch(() => {});

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

export default router;
```

- [ ] **Step 2: Mount the route**

In `backend/src/index.js`, add the import next to the other route imports:

```js
import clientProfileRoutes from './routes/clientProfile.js';
```

And mount it next to the other `app.use('/api/...)` lines:

```js
app.use('/api/client-profile', clientProfileRoutes);
```

- [ ] **Step 3: Verify manually**

Start the backend (`cd backend && npm run dev`), register a test user, then:

```bash
TOKEN="<paste the token from the register response>"
curl -s -X POST http://localhost:3001/api/client-profile \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"phone":"0501234567","id_number":"123456789","birth_date":"1990-01-01","id_issue_date":"2010-05-05","risk_tolerance":"מאוזן","investment_horizon":"ארוך","financial_knowledge":"בינוני","goals":"חיסכון לפרישה","life_stage":"משפחה עם ילדים"}'
```

Expected: JSON with the inserted row (including `id`, `status: "ממתין למשיכת מסלקה"`).

```bash
curl -s http://localhost:3001/api/client-profile -H "Authorization: Bearer $TOKEN"
```

Expected: the same row back.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/clientProfile.js backend/src/index.js
git commit -m "feat: add client-profile create/read endpoints"
```

---

### Task 4: `GET /api/admin/clients`

**Files:**
- Create: `backend/src/routes/admin.js`
- Modify: `backend/src/index.js`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: `authMiddleware`; `process.env.ADMIN_EMAIL`.
- Produces: `GET /api/admin/clients` → 200 with an array of `{ id, name, email, phone, status, created_at }` (one per registered client, newest first) if `req.user.email === process.env.ADMIN_EMAIL`, else 403.

- [ ] **Step 1: Create the route file**

Create `backend/src/routes/admin.js`:

```js
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
```

- [ ] **Step 2: Mount the route and document the env var**

In `backend/src/index.js`:

```js
import adminRoutes from './routes/admin.js';
```

```js
app.use('/api/admin', adminRoutes);
```

In `backend/.env.example`, add:

```
ADMIN_EMAIL=david@davit-fin.co.il
ADMIN_WHATSAPP_NUMBER=972532556099
```

- [ ] **Step 3: Verify manually**

With `ADMIN_EMAIL` set in `backend/.env` to your own test user's email and the backend restarted:

```bash
curl -s http://localhost:3001/api/admin/clients -H "Authorization: Bearer $TOKEN"
```

Expected: a JSON array containing the profile created in Task 3.

Then with a token for a *different* (non-admin) user:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/admin/clients -H "Authorization: Bearer $OTHER_TOKEN"
```

Expected: `403`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/admin.js backend/src/index.js backend/.env.example
git commit -m "feat: add admin clients list endpoint"
```

---

### Task 5: Registration wizard (frontend)

**Files:**
- Modify: `frontend/src/pages/Register.jsx`
- Modify: `frontend/src/api/client.js` — no changes needed (already attaches the token); listed here only so the executor knows it's the file that does so.

**Interfaces:**
- Consumes: `useAuth().register(name, email, password)` (existing, unchanged); `api` default export from `frontend/src/api/client.js` (existing, unchanged) for the `POST /api/client-profile` call from Task 3.
- Produces: after step 3, the wizard has called `register()` (step 1) and then `POST /api/client-profile` (step 3), and navigates to `/`.

- [ ] **Step 1: Rewrite Register.jsx as a 3-step wizard**

Replace the entire contents of `frontend/src/pages/Register.jsx`:

```jsx
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

const QUESTIONS = [
  { key: 'risk_tolerance', label: 'מה סיבולת הסיכון שלך?', options: ['שמרן', 'מאוזן', 'נועז'] },
  { key: 'investment_horizon', label: 'מה אופק ההשקעה שלך?', options: ['קצר (עד 3 שנים)', 'בינוני (3-10 שנים)', 'ארוך (10+ שנים)'] },
  { key: 'financial_knowledge', label: 'מה רמת הידע הפיננסי שלך?', options: ['מתחיל', 'בינוני', 'מתקדם'] },
  { key: 'goals', label: 'מה המטרה הפיננסית העיקרית שלך?', options: ['חיסכון לפרישה', 'רכישת דירה', 'גידול הון', 'ביטחון כלכלי'] },
  { key: 'life_stage', label: 'מה שלב החיים שלך?', options: ['רווק/ה', 'זוג ללא ילדים', 'משפחה עם ילדים', 'לקראת פרישה'] },
];

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [account, setAccount] = useState({ name: '', email: '', password: '', phone: '' });
  const [idInfo, setIdInfo] = useState({ id_number: '', birth_date: '', id_issue_date: '' });
  const [answers, setAnswers] = useState({});

  const submitAccount = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(account.name, account.email, account.password);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בהרשמה');
    } finally {
      setLoading(false);
    }
  };

  const submitIdInfo = e => {
    e.preventDefault();
    setStep(3);
  };

  const submitQuestionnaire = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/client-profile', {
        phone: account.phone,
        id_number: idInfo.id_number,
        birth_date: idInfo.birth_date,
        id_issue_date: idInfo.id_issue_date,
        ...answers,
      });
      nav('/');
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בשמירת הפרופיל');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">💵</div>
        <h1>NETWORTH</h1>
        <p className="auth-subtitle">שלב {step} מתוך 3</p>

        {step === 1 && (
          <form onSubmit={submitAccount}>
            <div className="form-group">
              <label>שם מלא</label>
              <input value={account.name} onChange={e => setAccount(p => ({ ...p, name: e.target.value }))} required placeholder="ישראל ישראלי" />
            </div>
            <div className="form-group">
              <label>טלפון</label>
              <input value={account.phone} onChange={e => setAccount(p => ({ ...p, phone: e.target.value }))} required placeholder="050-1234567" />
            </div>
            <div className="form-group">
              <label>אימייל</label>
              <input type="email" value={account.email} onChange={e => setAccount(p => ({ ...p, email: e.target.value }))} required placeholder="your@email.com" />
            </div>
            <div className="form-group">
              <label>סיסמה</label>
              <input type="password" value={account.password} onChange={e => setAccount(p => ({ ...p, password: e.target.value }))} required placeholder="לפחות 6 תווים" minLength={6} />
            </div>
            {error && <div className="form-error">{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'יוצר חשבון...' : 'המשך'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submitIdInfo}>
            <div className="form-group">
              <label>תעודת זהות</label>
              <input value={idInfo.id_number} onChange={e => setIdInfo(p => ({ ...p, id_number: e.target.value }))} required placeholder="123456789" />
            </div>
            <div className="form-group">
              <label>תאריך לידה</label>
              <input type="date" value={idInfo.birth_date} onChange={e => setIdInfo(p => ({ ...p, birth_date: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>תאריך הנפקת תעודת הזהות</label>
              <input type="date" value={idInfo.id_issue_date} onChange={e => setIdInfo(p => ({ ...p, id_issue_date: e.target.value }))} required />
            </div>
            <button type="submit" className="btn-primary">המשך</button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={submitQuestionnaire}>
            {QUESTIONS.map(q => (
              <div className="form-group" key={q.key}>
                <label>{q.label}</label>
                <select
                  value={answers[q.key] || ''}
                  onChange={e => setAnswers(p => ({ ...p, [q.key]: e.target.value }))}
                  required
                >
                  <option value="" disabled>בחר...</option>
                  {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            {error && <div className="form-error">{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'שומר...' : 'סיום והמשך לאזור האישי'}
            </button>
          </form>
        )}

        {step === 1 && <p className="auth-link">יש לך חשבון? <Link to="/login">התחבר</Link></p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify manually in the browser**

Start both backend and frontend locally, go to `/register`, and walk through all 3 steps with real values. Expected: after step 3, you land on `/` (the NETWORTH main screen) and are logged in.

Then confirm the profile was actually saved:

```bash
curl -s http://localhost:3001/api/client-profile -H "Authorization: Bearer <token from localStorage>"
```

Expected: the row with the values you typed.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Register.jsx
git commit -m "feat: turn registration into 3-step onboarding wizard"
```

---

### Task 6: Admin clients page

**Files:**
- Create: `frontend/src/pages/AdminClients.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/Layout.jsx`
- Modify: `frontend/.env.example`

**Interfaces:**
- Consumes: `api` from `frontend/src/api/client.js`; `useAuth()` for the current `user`; `GET /api/admin/clients` from Task 4.
- Produces: route `/admin/clients` rendering a table of clients; a drawer link to it, visible only when `user.email === import.meta.env.VITE_ADMIN_EMAIL`.

- [ ] **Step 1: Create the page**

Create `frontend/src/pages/AdminClients.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import api from '../api/client';

export default function AdminClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/clients')
      .then(({ data }) => setClients(data))
      .catch(err => setError(err.response?.data?.error || 'שגיאה בטעינת הלקוחות'));
  }, []);

  if (user && import.meta.env.VITE_ADMIN_EMAIL && user.email !== import.meta.env.VITE_ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="page">
      <div className="page-header"><h2>לקוחות</h2></div>

      {error && <div className="form-error">{error}</div>}
      {!clients && !error && <div className="loading">טוען...</div>}

      {clients?.length === 0 && (
        <div className="empty-state">
          <p>אף אחד עדיין לא נרשם</p>
        </div>
      )}

      {clients?.length > 0 && (
        <div className="card">
          {clients.map(c => (
            <div key={c.id} className="budget-card">
              <div className="budget-header">
                <span className="budget-cat">{c.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.status}</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {c.email} · {c.phone || 'אין טלפון'} · נרשם ב-{new Date(c.created_at).toLocaleDateString('he-IL')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the route**

In `frontend/src/App.jsx`, add the import next to the other page imports:

```js
import AdminClients from './pages/AdminClients';
```

And add the route next to the other `<ProtectedRoute>` routes:

```jsx
<Route path="/admin/clients" element={<ProtectedRoute><AdminClients /></ProtectedRoute>} />
```

- [ ] **Step 3: Add the drawer link**

In `frontend/src/components/Layout.jsx`, add `Users` to the lucide-react import line:

```js
import { LayoutDashboard, Receipt, TrendingUp, Menu, X, Target, Tag, Upload, LogOut, Wallet, Shield, PiggyBank, Users } from 'lucide-react';
```

Then add a new drawer item, right after the existing `<button className="drawer-item" onClick={() => go('/summary')}>` block:

```jsx
{user?.email === import.meta.env.VITE_ADMIN_EMAIL && (
  <button className="drawer-item" onClick={() => go('/admin/clients')}>
    <Users size={20}/> לקוחות (מנהל)
  </button>
)}
```

- [ ] **Step 4: Document the frontend env var**

In `frontend/.env.example`, add:

```
VITE_ADMIN_EMAIL=david@davit-fin.co.il
```

- [ ] **Step 5: Verify manually**

Set `VITE_ADMIN_EMAIL` in `frontend/.env` to the email of the test user you registered in Task 5, restart the frontend dev server, log in as that user, open the drawer (☰) — expected: "לקוחות (מנהל)" link is visible. Click it — expected: `/admin/clients` shows a row for the client created in Task 5.

Then log in (or check `/auth/me`) as a *different* user whose email doesn't match `VITE_ADMIN_EMAIL` — expected: the drawer link is not shown, and navigating to `/admin/clients` directly redirects to `/`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/AdminClients.jsx frontend/src/App.jsx frontend/src/components/Layout.jsx frontend/.env.example
git commit -m "feat: add admin clients dashboard"
```

---

## Self-Review Notes

- **Spec coverage:** 3-step registration (Task 5) ✓, ID fields + questionnaire (Task 5) ✓, `client_profiles` table (Task 1) ✓, WhatsApp notification via existing bot (Tasks 2–3) ✓, admin dashboard v1 (Tasks 4, 6) ✓. Email notification and persisting מסלקה/הר ביטוח data per-client are explicitly out of scope per the spec and are not tasked here.
- **Placeholder scan:** no TBD/TODO; every step has concrete code or an exact command.
- **Type/name consistency:** `client_profiles` columns match across Task 1 (schema), Task 3 (insert/select), and Task 4 (select) — verified `phone`, `status`, `created_at` spelled identically everywhere. `notifyNewClient({ name, phone })` signature matches its Task 2 definition and its Task 3 call site.
