import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import BudgetImport from '../components/BudgetImport';
import ReportImport from '../components/ReportImport';
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
    console.error('raw upload save failed:', err);
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
      setMaslakaStatus({ pension: pensionCards.length, insurance: insuranceCards.length, name: clients?.find(c => c.id === targetId)?.name || '' });
    } catch (err) {
      console.error('maslaka import failed:', err);
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
      const matchedNames = [];
      let matched = 0;
      let unmatched = 0;
      await Promise.all(Array.from(cardsByTz.entries()).map(async ([tz, cards]) => {
        const client = findClientByIdNumber(clients, tz) || (isSinglePersonFile ? clients?.find(c => c.id === clientId) : null);
        if (!client) { unmatched++; return; }
        matched++;
        matchedNames.push(client.name);
        await api.put(`/admin/clients/${client.id}/financial-data`, { harBituachData: cards });
      }));

      saveRawUpload(file, 'har_bituach', null);
      setHarBituachStatus({ matched, unmatched, names: matchedNames });
    } catch (err) {
      console.error('har bituach import failed:', err);
      setHarBituachStatus('error');
    }
  };

  return (
    <>
      <p>הייבוא שומר נתונים בתיק הלקוח. הודעת WhatsApp תישלח רק לאחר אישור ופרסום המלצות.</p>
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
            נשמרו {maslakaStatus.pension} מוצרי גמל/פנסיה ו-{maslakaStatus.insurance} פוליסות ביטוח עבור {maslakaStatus.name}. לא נשלחה הודעה.
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
            עודכנו {harBituachStatus.matched} לקוחות: {harBituachStatus.names.join(', ')}. לא נשלחה הודעה.
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
          console.error('reprocess failed for upload', u.id, err);
          errors++;
        }
      }
      setStatus({ done, total: uploads.length, errors });
    } catch (err) {
      console.error('reprocess-all failed:', err);
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

export default function Import() {
  const { user } = useAuth();
  const [section,setSection]=useState('budget');
  if (user && import.meta.env.VITE_ADMIN_EMAIL && user.email !== import.meta.env.VITE_ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>העלאת נתונים</h2>
      </div>
      <div className="bw"><nav className="bw-tabs"><button aria-pressed={section==='budget'} onClick={()=>setSection('budget')}>התקציב האישי שלי</button><button aria-pressed={section==='clients'} onClick={()=>setSection('clients')}>תיקי לקוחות</button></nav></div>
      {section==='budget'?<BudgetImport/>:<>      <h2 style={{ fontSize: '1.1rem', margin: '20px 0 8px' }}>ייבוא מסלקה (לך בלבד — לא מוצג ללקוח)</h2>
      <ReportImport />

      <h2 style={{ fontSize: '1.1rem', margin: '20px 0 8px' }}>תחזוקה</h2>
      <p>הייבוא החדש שומר דוחות היסטוריים בלבד. עיבוד גורף של הקבצים הישנים מושבת במסך זה כדי למנוע דריסת נתונים.</p></>}
    </div>
  );
}
