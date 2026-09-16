import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { filesFromUploads, processMaslakaFiles, processHarBituachBuffer } from '../lib/maslakaCards';
import { normalizeIsraeliId } from '../lib/israeliId';

// משווה ת.ז בין מקורות (מסלקה/הר ביטוח/טופס הרשמה) בפורמט קנוני, כי כל אחד עלול לשמור
// אחרת (עם/בלי אפסים מובילים).
function findClientByIdNumber(clients, id) {
  if (!id) return null;
  const target = normalizeIsraeliId(id);
  return clients?.find(c => c.id_number && normalizeIsraeliId(c.id_number) === target) || null;
}

// שומר עותק של קובץ המקור הגולמי ב-DB כדי ש"פרסר מחדש את כולם" יוכל להשתמש בו בעתיד -
// לא חוסם את ההעלאה עצמה אם זה נכשל.
async function saveRawUpload(file, source, userId) {
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('source', source);
    if (userId) fd.append('userId', userId);
    await api.post('/admin/raw-uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  } catch (err) {
    console.error('raw upload save failed:', err); // eslint-disable-line no-console
  }
}

function MaslakaImportSection() {
  const [clients, setClients] = useState(null);
  const [clientId, setClientId] = useState('');
  const [maslakaStatus, setMaslakaStatus] = useState(null);
  const [harBituachStatus, setHarBituachStatus] = useState(null);

  useEffect(() => {
    api.get('/admin/clients').then(({ data }) => setClients(data)).catch(() => setClients([]));
  }, []);

  const handleMaslakaFiles = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (!fileList.length) return;
    setMaslakaStatus('loading');
    try {
      const files = await filesFromUploads(fileList);
      const { pensionCards, insuranceCards, clientInfo } = processMaslakaFiles(files);
      if (!pensionCards.length && !insuranceCards.length) { setMaslakaStatus('error'); return; }
      const targetId = clientId || findClientByIdNumber(clients, clientInfo?.id)?.id;
      if (!targetId) { setMaslakaStatus('no-client'); return; }
      await api.put(`/admin/clients/${targetId}/financial-data`, {
        pensionData: pensionCards.length ? pensionCards : undefined,
        insuranceData: insuranceCards.length ? insuranceCards : undefined,
        clientInfo: clientInfo || undefined,
      });
      saveRawUpload(fileList[0], 'maslaka', targetId);
      if (!clientId) setClientId(targetId);
      setMaslakaStatus({ pension: pensionCards.length, insurance: insuranceCards.length });
    } catch (err) {
      console.error('maslaka import failed:', err); // eslint-disable-line no-console
      setMaslakaStatus('error');
    }
  };

  const handleHarBituachFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHarBituachStatus('loading');
    try {
      const buf = await file.arrayBuffer();
      const cardsByTz = processHarBituachBuffer(buf);
      if (!cardsByTz.size) { setHarBituachStatus('error'); return; }

      // אם זה קובץ של אדם אחד בלבד (ת.ז אחת) והוא לא זוהה - וייבחר לקוח למעלה, מניחים שזה
      // בכוונה (בדיקה על יוזר טסטינג, למשל). בקובץ מרוכז אמיתי (הרבה ת.ז) לא מנחשים בכלל -
      // עדיף לדווח "לא זוהה" מאשר לשייך בטעות נתונים של מישהו אחר ללקוח שנבחר במקרה.
      const isSinglePersonFile = cardsByTz.size === 1;
      let matched = 0;
      let unmatched = 0;
      await Promise.all(Array.from(cardsByTz.entries()).map(async ([tz, cards]) => {
        const client = findClientByIdNumber(clients, tz) || (isSinglePersonFile ? clients?.find(c => c.id === clientId) : null);
        if (!client) { unmatched++; return; }
        matched++;
        await api.put(`/admin/clients/${client.id}/financial-data`, { harBituachData: cards });
      }));

      saveRawUpload(file, 'har_bituach', null);
      setHarBituachStatus({ matched, unmatched });
    } catch (err) {
      console.error('har bituach import failed:', err); // eslint-disable-line no-console
      setHarBituachStatus('error');
    }
  };

  return (
    <>
      <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>בחר לקוח</label>
        <select value={clientId} onChange={e => setClientId(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '8px' }}>
          <option value="">— בחר לקוח —</option>
          {clients?.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>🗂️ מסלקה - גמל, פנסיה וביטוחים</div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          קובץ ה-ZIP שמתקבל מהמסלקה (או קובצי XML בודדים אם כבר חילצת). אם ת.ז בקובץ תואמת ללקוח רשום, ייבחר אוטומטית — אחרת בחר לקוח למעלה קודם.
        </p>
        <input type="file" accept=".zip,.xml" multiple onChange={handleMaslakaFiles} style={{ fontSize: '0.8rem' }} />
        {maslakaStatus === 'loading' && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>מעבד...</p>}
        {maslakaStatus === 'error' && <p style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: '6px' }}>לא נמצאו מוצרים או פוליסות בקובץ.</p>}
        {maslakaStatus === 'no-client' && <p style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: '6px' }}>ת.ז מהקובץ לא נמצאה במערכת — בחר לקוח ידנית למעלה ונסה שוב.</p>}
        {maslakaStatus && maslakaStatus !== 'loading' && maslakaStatus !== 'error' && maslakaStatus !== 'no-client' && (
          <p style={{ fontSize: '0.78rem', color: '#22c55e', marginTop: '6px' }}>
            נשמרו {maslakaStatus.pension} מוצרי גמל/פנסיה ו-{maslakaStatus.insurance} פוליסות ביטוח ללקוח.
          </p>
        )}
      </div>

      <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>🗂️ הר הביטוח</div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          קובץ Excel מרוכז לכמה לקוחות — לא צריך לבחור לקוח, כל שורה מנותבת אוטומטית לפי ת.ז.
          (קובץ של אדם אחד שהת.ז שלו לא זוהתה יופנה ללקוח שנבחר למעלה, אם נבחר).
        </p>
        <input type="file" accept=".xlsx,.xls" onChange={handleHarBituachFile} style={{ fontSize: '0.8rem' }} />
        {harBituachStatus === 'loading' && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>מעבד...</p>}
        {harBituachStatus === 'error' && <p style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: '6px' }}>לא נמצאו שורות בקובץ.</p>}
        {harBituachStatus && harBituachStatus !== 'loading' && harBituachStatus !== 'error' && (
          <p style={{ fontSize: '0.78rem', color: '#22c55e', marginTop: '6px' }}>
            עודכנו {harBituachStatus.matched} לקוחות.
            {harBituachStatus.unmatched > 0 && ` ${harBituachStatus.unmatched} תעודות זהות לא זוהו במערכת (לקוח לא רשום).`}
          </p>
        )}
      </div>
    </>
  );
}

function bufferToFileLike(name, arrayBuffer) {
  return {
    name,
    arrayBuffer: async () => arrayBuffer,
    text: async () => new TextDecoder('utf-8').decode(arrayBuffer),
  };
}

// מריץ את הפרסר העדכני מחדש על כל קבצי המקור השמורים ומעדכן את כל הלקוחות בבת אחת -
// לתיקון באג בפרסר בלי לבקש מאף לקוח או מהסוכן להעלות שוב.
function ReprocessAllSection() {
  const [status, setStatus] = useState(null);

  const runAll = async () => {
    setStatus('running');
    try {
      const [{ data: uploads }, { data: clients }] = await Promise.all([
        api.get('/admin/raw-uploads'),
        api.get('/admin/clients'),
      ]);
      let done = 0, errors = 0;
      for (const u of uploads) {
        try {
          const { data: buf } = await api.get(`/admin/raw-uploads/${u.id}/file`, { responseType: 'arraybuffer' });
          if (u.source === 'maslaka' && u.user_id) {
            const files = await filesFromUploads([bufferToFileLike(u.filename, buf)]);
            const { pensionCards, insuranceCards, clientInfo } = processMaslakaFiles(files);
            await api.put(`/admin/clients/${u.user_id}/financial-data`, {
              pensionData: pensionCards.length ? pensionCards : undefined,
              insuranceData: insuranceCards.length ? insuranceCards : undefined,
              clientInfo: clientInfo || undefined,
            });
          } else if (u.source === 'har_bituach') {
            const cardsByTz = processHarBituachBuffer(buf);
            for (const [tz, cards] of cardsByTz) {
              const client = findClientByIdNumber(clients, tz);
              if (client) await api.put(`/admin/clients/${client.id}/financial-data`, { harBituachData: cards });
            }
          }
          done++;
        } catch (err) {
          console.error('reprocess failed for upload', u.id, err); // eslint-disable-line no-console
          errors++;
        }
      }
      setStatus({ done, total: uploads.length, errors });
    } catch (err) {
      console.error('reprocess-all failed:', err); // eslint-disable-line no-console
      setStatus({ done: 0, total: 0, errors: 1, fatal: true });
    }
  };

  return (
    <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>🔄 פרסר מחדש את כולם</div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
        מריץ את הפרסר העדכני מחדש על כל קבצי המקור ששמורים (מסלקה + הר ביטוח) ומעדכן את כל הלקוחות. להריץ אחרי תיקון באג בפרסר.
      </p>
      <button className="btn-primary" onClick={runAll} disabled={status === 'running'}>
        {status === 'running' ? 'מריץ מחדש...' : 'פרסר מחדש את כולם'}
      </button>
      {status && status !== 'running' && (
        <p style={{ fontSize: '0.78rem', color: status.errors ? '#ef4444' : '#22c55e', marginTop: '6px' }}>
          {status.fatal ? 'שגיאה כללית בהרצה.' : `הושלם: ${status.done}/${status.total} קבצים${status.errors ? `, ${status.errors} נכשלו` : ''}.`}
        </p>
      )}
    </div>
  );
}

const SOURCES = [
  {
    id: 'discount-auto',
    name: 'דיסקונט',
    icon: '🏦',
    color: '#1e40af',
    accept: '.xlsx,.xls',
    field: 'file',
    endpoint: '/import/discount-auto',
    instructions: [
      'עו"ש: עסקאות → עובר ושב → ייצוא Excel',
      'ויזה: כרטיסי אשראי → פירוט עסקאות וזיכויים → Excel',
    ],
  },
  {
    id: 'max-auto',
    name: 'מקס',
    icon: '💳',
    color: '#dc2626',
    accept: '.xlsx,.xls',
    field: 'file',
    endpoint: '/import/max-auto',
    instructions: ['max.co.il → עסקאות → ייצוא Excel'],
  },
  {
    id: 'cal',
    name: 'כאל',
    icon: '💳',
    color: '#7c3aed',
    accept: '.xlsx,.xls',
    field: 'file',
    endpoint: '/import/cal',
    instructions: ['cal-online.co.il → עסקאות → פירוט עסקאות → Excel'],
  },
];

function ImportCard({ source }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const fileRef = useRef();

  const handleFile = e => {
    setFile(e.target.files[0]);
    setResult(null);
    setError('');
  };

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const fd = new FormData();
      fd.append(source.field, file);
      const { data } = await api.post(source.endpoint, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בייבוא');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '12px', overflow: 'visible' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ fontSize: '1.5rem' }}>{source.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{source.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>לחץ לייבוא</div>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
          {/* הוראות */}
          <div style={{ margin: '12px 0', background: 'var(--bg)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>איך מייצאים:</div>
            {source.instructions.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '5px', alignItems: 'center' }}>
                <span style={{ background: source.color, color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>{i+1}</span>
                <span style={{ fontSize: '0.82rem' }}>{step}</span>
              </div>
            ))}
          </div>

          {/* העלאת קובץ */}
          <div
            onClick={() => fileRef.current.click()}
            style={{ border: '2px dashed var(--border)', borderRadius: '10px', padding: '14px', textAlign: 'center', cursor: 'pointer', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}
          >
            <FileText size={20} style={{ margin: '0 auto 6px', display: 'block' }} />
            {file ? <strong style={{ color: 'var(--text)' }}>{file.name}</strong> : `בחר קובץ ${source.accept}`}
          </div>
          <input ref={fileRef} type="file" accept={source.accept} hidden onChange={handleFile} />

          {file && (
            <button className="btn-primary" onClick={submit} disabled={loading}>
              {loading ? 'מייבא...' : `📥 ייבא מ${source.name}`}
            </button>
          )}

          {result && (
            <div style={{ marginTop: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontWeight: 700, marginBottom: '4px' }}>
                <CheckCircle size={16} /> ייבוא הושלם!
              </div>
              ✅ יובאו <strong>{result.imported}</strong> עסקאות ·
              ⏭️ כפילויות: <strong>{result.skipped}</strong>
            </div>
          )}

          {error && (
            <div style={{ marginTop: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', fontSize: '0.85rem', color: 'var(--danger)', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Import() {
  const { user } = useAuth();
  if (user && import.meta.env.VITE_ADMIN_EMAIL && user.email !== import.meta.env.VITE_ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>ייבוא עסקאות</h2>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
        ייבא עסקאות מהבנק והאשראי שלך. כפילויות מזוהות אוטומטית.
      </p>
      {SOURCES.map(s => <ImportCard key={s.id} source={s} />)}

      <h2 style={{ fontSize: '1.1rem', margin: '20px 0 8px' }}>ייבוא מסלקה (לך בלבד — לא מוצג ללקוח)</h2>
      <MaslakaImportSection />

      <h2 style={{ fontSize: '1.1rem', margin: '20px 0 8px' }}>תחזוקה</h2>
      <ReprocessAllSection />
    </div>
  );
}
