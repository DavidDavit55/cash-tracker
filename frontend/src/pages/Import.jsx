import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import api from '../api/client';
import { useMaslakaData } from '../hooks/useMaslakaData';
import { parseMaslakaFiles } from '../lib/maslakaParser';
import { fmt } from '../components/ProductCard';

function mapPensionItemToCard(item, kind) {
  const tracks = item.tracks || [];
  const mainTrack = tracks.length ? tracks.reduce((a, b) => (b.pct || 0) > (a.pct || 0) ? b : a) : null;
  const balance = parseFloat(kind === 'pension' ? item.savings : item.tzvira);
  return {
    id: item.policyNum || `${kind}-${item.plan}-${item.company}`,
    name: item.plan || item.company,
    provider: item.company,
    type: kind === 'pension' ? 'pension' : 'gemel',
    balance: isNaN(balance) ? 0 : balance,
    feeFromDeposit: item.dmeiNihulHafkada ? parseFloat(item.dmeiNihulHafkada) : null,
    feeFromAccumulation: item.dmeiNihulTzvira ? parseFloat(item.dmeiNihulTzvira) : null,
    investmentTrack: mainTrack?.name || '',
    stockExposure: null,
    isDefaultTrack: /\d+\s*(שנה|ומטה|ומעלה)|תלוי גיל/.test(mainTrack?.name || ''),
    return12m: item.netReturn ? parseFloat(item.netReturn) : null,
  };
}

function guessInsuranceType(label) {
  if (!label) return 'other';
  if (label.includes('בריאות')) return 'health';
  if (label.includes('חיים')) return 'life';
  if (label.includes('מנהלים')) return 'managers';
  if (label.includes('תאונות')) return 'accident';
  if (label.includes('ריסק')) return 'life';
  return 'other';
}

function mapInsuranceItemToCard(entry, isManagers) {
  const premium = parseFloat(entry.premium) || null;
  const coverageItems = [];
  if (isManagers) {
    if (entry.riskAmount) coverageItems.push(`ריסק/חיים — כיסוי ${fmt(parseFloat(entry.riskAmount))}`);
    if (entry.akeMonthly) coverageItems.push(`אובדן כושר עבודה — קצבה חודשית ${fmt(parseFloat(entry.akeMonthly))}`);
    if (entry.track) coverageItems.push(`מסלול השקעה: ${entry.track}`);
    if (entry.tzvira) coverageItems.push(`צבירה: ${fmt(parseFloat(entry.tzvira))}`);
  } else if (entry.pledgedTo) {
    coverageItems.push(`משועבד ל: ${entry.pledgedTo}`);
  }
  const coverage = entry.sumInsured ? parseFloat(entry.sumInsured) : (entry.riskAmount ? parseFloat(entry.riskAmount) : null);
  return {
    id: entry.policyNum || `${entry.company}-${entry.plan}`,
    type: guessInsuranceType(entry.type),
    name: entry.plan || entry.type,
    provider: entry.company,
    monthlyPremium: premium,
    coverage,
    coverageItems: coverageItems.length ? coverageItems : ['אין פרטי כיסוי נוספים בקובץ המסלקה'],
  };
}

function MaslakaImportSection() {
  const { setPensionOverride, setInsuranceOverride, setClientInfo } = useMaslakaData();
  const [pensionStatus, setPensionStatus] = useState(null);
  const [insuranceStatus, setInsuranceStatus] = useState(null);

  const handlePensionFiles = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (!fileList.length) return;
    setPensionStatus('loading');
    try {
      const files = await Promise.all(fileList.map(async f => ({ name: f.name, text: await f.text() })));
      const result = parseMaslakaFiles(files);
      const cards = [
        ...result.pension.map(p => mapPensionItemToCard(p, 'pension')),
        ...result.study_fund.map(s => mapPensionItemToCard(s, 'study_fund')),
      ];
      if (!cards.length) { setPensionStatus('error'); return; }
      setPensionOverride(cards);
      if (result.client) setClientInfo(result.client);
      setPensionStatus({ count: cards.length });
    } catch (err) {
      console.error('maslaka pension import failed:', err); // eslint-disable-line no-console
      setPensionStatus('error');
    }
  };

  const handleInsuranceFiles = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (!fileList.length) return;
    setInsuranceStatus('loading');
    try {
      const files = await Promise.all(fileList.map(async f => ({ name: f.name, text: await f.text() })));
      const result = parseMaslakaFiles(files);
      const cards = [
        ...result.insurance.map(e2 => mapInsuranceItemToCard(e2, false)),
        ...result.managers_insurance.map(e2 => mapInsuranceItemToCard(e2, true)),
      ];
      if (!cards.length) { setInsuranceStatus('error'); return; }
      setInsuranceOverride(cards);
      setInsuranceStatus({ count: cards.length });
    } catch {
      setInsuranceStatus('error');
    }
  };

  return (
    <>
      <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>🗂️ מסלקה - גמל ופנסיה</div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          קובצי XML (CONSLTPNN / CONSLTKGM) — נשארים בדפדפן, לא נשלחים לשום שרת.
        </p>
        <input type="file" accept=".xml" multiple onChange={handlePensionFiles} style={{ fontSize: '0.8rem' }} />
        {pensionStatus === 'loading' && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>מעבד...</p>}
        {pensionStatus === 'error' && <p style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: '6px' }}>לא נמצאו מוצרים בקובץ.</p>}
        {pensionStatus?.count && <p style={{ fontSize: '0.78rem', color: '#22c55e', marginTop: '6px' }}>יובאו {pensionStatus.count} מוצרים — יופיעו במסך גמל/פנסיה.</p>}
      </div>

      <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>🗂️ מסלקה - ביטוחים</div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          קובצי XML של ביטוחי חיים/מנהלים/בריאות (ING/INK/INP/INM).
        </p>
        <input type="file" accept=".xml" multiple onChange={handleInsuranceFiles} style={{ fontSize: '0.8rem' }} />
        {insuranceStatus === 'loading' && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>מעבד...</p>}
        {insuranceStatus === 'error' && <p style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: '6px' }}>לא נמצאו פוליסות בקובץ.</p>}
        {insuranceStatus?.count && <p style={{ fontSize: '0.78rem', color: '#22c55e', marginTop: '6px' }}>יובאו {insuranceStatus.count} פוליסות — יופיעו במסך הגנות.</p>}
      </div>
    </>
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
    </div>
  );
}
