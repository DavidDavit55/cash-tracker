import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import api from '../api/client';

export default function Import() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
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
      fd.append('csv', file);
      const { data } = await api.post('/import/riseup', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בייבוא');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>ייבוא מרייזאפ</h2>
      </div>

      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <img src="https://www.riseup.co.il/favicon.ico" alt="RiseUp" width={24} onError={e => e.target.style.display='none'} />
          <h3 style={{ margin: 0 }}>ייבוא עסקאות מ-RiseUp</h3>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.6 }}>
          ב-RiseUp: לחץ על <strong>"עסקאות"</strong> → <strong>"ייצוא לאקסל"</strong> → שמור כ-CSV ← ואז העלה כאן.
        </p>

        <div
          className="receipt-btn"
          style={{ marginBottom: '16px', cursor: 'pointer', width: '100%' }}
          onClick={() => fileRef.current.click()}
        >
          <FileText size={28} />
          <span style={{ fontWeight: 600 }}>
            {file ? file.name : 'בחר קובץ CSV מרייזאפ'}
          </span>
          {file && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB</span>}
        </div>
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={handleFile} />

        {file && (
          <button className="btn-primary" onClick={submit} disabled={loading}>
            {loading ? 'מייבא...' : '📥 ייבא עסקאות'}
          </button>
        )}

        {result && (
          <div style={{ marginTop: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: 700, marginBottom: '8px' }}>
              <CheckCircle size={20} />
              ייבוא הושלם בהצלחה!
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#166534' }}>
              ✅ יובאו <strong>{result.imported}</strong> עסקאות<br />
              ⏭️ דולגו <strong>{result.skipped}</strong> (כפילויות)<br />
              📊 סה"כ בקובץ: <strong>{result.total}</strong>
            </p>
          </div>
        )}

        {error && (
          <div style={{ marginTop: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontWeight: 600 }}>
              <AlertCircle size={18} />
              {error}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '16px' }}>
        <h3 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>איך מייצאים מרייזאפ?</h3>
        {[
          'פתח את אפליקציית רייזאפ',
          'לחץ על "עסקאות" בתפריט',
          'לחץ על האייקון של ייצוא (למעלה מימין)',
          'בחר "ייצוא לאקסל / CSV"',
          'שלח לעצמך במייל ושמור',
          'חזור לכאן ובחר את הקובץ',
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
            <span style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
            <span style={{ fontSize: '0.88rem', color: 'var(--text)' }}>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
