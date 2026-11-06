import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool from './db/pool.js';
import fs from 'fs';

dotenv.config();

import authRoutes from './routes/auth.js';
import expensesRoutes from './routes/expenses.js';
import categoriesRoutes from './routes/categories.js';
import budgetsRoutes from './routes/budgets.js';
import budgetWorkspaceRoutes from './routes/budgetWorkspace.js';
import importRoutes from './routes/import.js';
import incomesRoutes from './routes/incomes.js';
import clientProfileRoutes from './routes/clientProfile.js';
import adminRoutes from './routes/admin.js';
import reportSnapshotRoutes from './routes/reportSnapshots.js';
import gmailRoutes from './routes/gmail.js';
import phoneVerifyRoutes from './routes/phoneVerify.js';
import {createOperationalCrm} from './routes/operationalCrm.js';
import {authMiddleware} from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use((_req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','same-origin');next();});
const PORT = process.env.PORT || 3001;

// מריץ מאחורי פרוקסי של Railway - בלי זה req.ip מחזיר את כתובת הפרוקסי, לא של הלקוח בפועל
// (צריך כתובת אמיתית ליומן החתימה על ייפויי הכוח).
app.set('trust proxy', true);

// FRONTEND_URL תומך בכמה כתובות מופרדות בפסיק (למשל: money.davit-fin.co.il,networth.davit-fin.co.il)
const allowedOrigins = (process.env.FRONTEND_URL || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '3mb' })); // תמונת חתימה (dataURL) יכולה להיות כמה מאות KB
// Receipts are served only through the authenticated, owner-scoped expense route.
app.use('/uploads', (_req,res)=>res.sendStatus(404));

app.use('/api/auth', authRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/budget-workspace', budgetWorkspaceRoutes);
app.use('/api/incomes', incomesRoutes);
// Retired QR-based budget bot. Operational Twilio messaging is separate.
app.use('/api/whatsapp', (_req,res)=>res.sendStatus(410));
app.use('/api/client-profile', clientProfileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/clients', reportSnapshotRoutes);
app.use('/api/admin/gmail', gmailRoutes);
app.use('/api/phone-verify', phoneVerifyRoutes);
app.use('/api/crm',createOperationalCrm({pool,authenticate:authMiddleware}));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use((error,_req,res,next)=>{
  if(res.headersSent)return next(error);
  // Do not expose stack traces, SQL, credentials or provider errors to clients.
  res.status(error?.type==='entity.too.large'?413:500).json({error:'הבקשה לא הושלמה'});
});

async function initDB() {
  const schema = fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf8');
  await pool.query(schema);
  await pool.query(fs.readFileSync(path.join(__dirname, 'db/gmail.sql'), 'utf8'));
  await pool.query(fs.readFileSync(path.join(__dirname, 'db/report-snapshots.sql'), 'utf8'));
  console.log('✅ DB schema initialized');
}

initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('DB init failed:', err);
    process.exit(1);
  });
