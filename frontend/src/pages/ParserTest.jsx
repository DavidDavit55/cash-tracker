import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { filesFromUploads, processMaslakaFiles, processHarBituachBuffer } from '../lib/maslakaCards';

// כלי אבחון לבדיקת הפרסר על הרבה קבצים אמיתיים בבת אחת - הכל בדפדפן, בלי לשמור כלום
// ל-DB ובלי לקשר לחשבון לקוח. ponytail: אין backend בכלל, אותה לוגיקת פרסור שכבר רצה ב-Import.jsx.
async function testMaslakaFile(file) {
  const entries = await filesFromUploads([file]);
  const { pensionCards, insuranceCards, clientInfo } = processMaslakaFiles(entries);
  return { clientInfo, pensionCards, insuranceCards };
}

async function testHarBituachFile(file) {
  const buf = await file.arrayBuffer();
  const byTz = processHarBituachBuffer(buf);
  return Object.fromEntries(byTz);
}

function ResultBlock({ name, status, error, data }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="chart-card" style={{ padding: '12px 16px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right', display: 'flex', justifyContent: 'space-between' }}
      >
        <span>{status === 'ok' ? '✅' : '❌'} {name}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{open ? 'סגור' : 'פרטים'}</span>
      </button>
      {open && (
        <pre style={{ fontSize: '0.72rem', whiteSpace: 'pre-wrap', marginTop: '10px', background: '#f8fafc', padding: '10px', borderRadius: '6px', direction: 'ltr', textAlign: 'left' }}>
          {error ? `שגיאה: ${error}` : JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function ParserTest() {
  const { user } = useAuth();
  const [maslakaResults, setMaslakaResults] = useState([]);
  const [harBituachResults, setHarBituachResults] = useState([]);
  const [running, setRunning] = useState(false);

  if (user && import.meta.env.VITE_ADMIN_EMAIL && user.email !== import.meta.env.VITE_ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  const runMaslaka = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setRunning(true);
    const results = [];
    for (const file of files) {
      try {
        const data = await testMaslakaFile(file);
        results.push({ name: file.name, status: 'ok', data });
      } catch (err) {
        results.push({ name: file.name, status: 'error', error: err.message });
      }
    }
    setMaslakaResults(results);
    setRunning(false);
  };

  const runHarBituach = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setRunning(true);
    const results = [];
    for (const file of files) {
      try {
        const data = await testHarBituachFile(file);
        results.push({ name: file.name, status: 'ok', data });
      } catch (err) {
        results.push({ name: file.name, status: 'error', error: err.message });
      }
    }
    setHarBituachResults(results);
    setRunning(false);
  };

  const okCount = (list) => list.filter(r => r.status === 'ok').length;

  return (
    <div className="page">
      <div className="page-header"><h2>בדיקת פרסר (אבחון בלבד)</h2></div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
        מעלים כאן קבצי מסלקה/הר ביטוח אמיתיים כדי לבדוק שהפרסר לא נשבר - שום דבר לא נשמר ל-DB ולא משויך ללקוח.
      </p>

      <div className="chart-card">
        <h3>קבצי מסלקה (ZIP או XML, אפשר כמה בבת אחת)</h3>
        <input type="file" accept=".zip,.xml" multiple onChange={runMaslaka} disabled={running} />
        {maslakaResults.length > 0 && (
          <div style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {okCount(maslakaResults)}/{maslakaResults.length} עברו בהצלחה
          </div>
        )}
      </div>

      {maslakaResults.map((r, i) => <ResultBlock key={i} {...r} />)}

      <div className="chart-card" style={{ marginTop: '20px' }}>
        <h3>קבצי הר ביטוח (Excel, אפשר כמה בבת אחת)</h3>
        <input type="file" accept=".xlsx,.xls" multiple onChange={runHarBituach} disabled={running} />
        {harBituachResults.length > 0 && (
          <div style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {okCount(harBituachResults)}/{harBituachResults.length} עברו בהצלחה
          </div>
        )}
      </div>

      {harBituachResults.map((r, i) => <ResultBlock key={i} {...r} />)}
    </div>
  );
}
