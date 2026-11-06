import { useEffect, useRef, useState } from 'react';
import { CloudDownload, FileUp, LogIn, RefreshCw, FlaskConical, ShieldCheck, LogOut } from 'lucide-react';
import { request, setSandboxToken } from './api';
import { normalizeIsraeliId } from '../lib/israeliId';
import { dedupById } from './productIdentity';
import { portfolio } from './model';
import { parseSource } from './parseSource';

const masked = id => id ? `•••••${String(id).slice(-4)}` : 'ללא מזהה';
export default function DataPanel({ auth, onAuth, onLogout, snapshot, onSnapshot, onLoad, onDemo, busy, loadError }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [uploads, setUploads] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importNotice, setImportNotice] = useState('');
  const resultsRef = useRef(null);
  const [connection, setConnection] = useState('');
  useEffect(() => {
    if (candidates.length) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [candidates]);
  const run = async action => { setWorking(true); setError(''); try { await action(); } catch (e) { setError(e.name === 'TimeoutError' ? 'הבקשה ארכה זמן רב מדי. אפשר לנסות שוב.' : e.message); } finally { setWorking(false); } };
  const login = e => { e.preventDefault(); run(async () => {
    if (!sent) { await request('/auth/login/send', { method: 'POST', body: { phone } }); setSent(true); }
    else {
      const data = await request('/auth/login/check', { method: 'POST', body: { phone, code } });
      setSandboxToken(data.token); onAuth(data.user); setCode(''); setSent(false);
      await onLoad('', data.user.name);
    }
  }); };
  const parse = async files => {
    if (!files.length || importing || busy) return;
    setImporting(true); setImportError(''); setImportNotice(''); setCandidates([]);
    try {
    const result = [];
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) throw new Error('אפשר לטעון קובץ עד 20MB');
      result.push(...await parseSource(file));
    }
    if (!result.length) throw new Error('לא נמצאו נתוני מסלקה או ביטוח בקובץ');
    const grouped = new Map();
    for (const item of result) {
      const id = item.client_info?.id ? normalizeIsraeliId(item.client_info.id) : null;
      const key = id && id !== '000000000' ? id : item.label;
      const old = grouped.get(key);
      grouped.set(key, old ? { ...old, pension_data: dedupById([...old.pension_data, ...item.pension_data]), insurance_data: dedupById([...old.insurance_data, ...item.insurance_data]), har_bituach_data: dedupById([...old.har_bituach_data, ...item.har_bituach_data]), client_info: { ...old.client_info, ...item.client_info }, label: `קבצים מאוחדים · ${item.client_info?.first || old.client_info?.first || masked(id)}` } : item);
    }
    finishImport([...grouped.values()]);
    } catch (e) { setImportError(e.message || 'לא ניתן לפענח את הקובץ. נסה לבחור אותו שוב.'); }
    finally { setImporting(false); }
  };
  const isSameClient = candidate => {
    const incoming = candidate.client_info?.id;
    const current = snapshot.client_info?.id || snapshot.profile?.id_number;
    return snapshot.source !== 'demo' && incoming && current && normalizeIsraeliId(incoming) !== '000000000' && normalizeIsraeliId(incoming) === normalizeIsraeliId(current);
  };
  const apply = (candidate, merge = false) => {
    const data = merge ? { ...snapshot, pension_data: dedupById([...candidate.pension_data, ...(snapshot.pension_data || [])]), insurance_data: dedupById([...candidate.insurance_data, ...(snapshot.insurance_data || [])]), har_bituach_data: dedupById([...candidate.har_bituach_data, ...(snapshot.har_bituach_data || [])]), client_info: { ...snapshot.client_info, ...candidate.client_info } } : candidate;
    onSnapshot({ ...data, source: 'file', loadedAt: new Date().toISOString(), warnings: [], clientId: null, label: candidate.label });
    setCandidates([]);
  };
  const finishImport = result => {
    if (result.length === 1 && isSameClient(result[0])) { apply(result[0], true); return; }
    if (result.length === 1 && ['demo', 'empty'].includes(snapshot.source)) { apply(result[0]); return; }
    setCandidates(result);
    setImportNotice(result.length > 1 ? `הקבצים פוענחו. נמצאו ${result.length} תיקים — בחר את הלקוח להצגה.` : 'הקובץ פוענח. לא אומתה התאמה ללקוח המוצג, ולכן צריך לבחור אם להחליף את התיק.');
  };
  return <div className="sb-data-workspace">
    <section className="sb-safety"><ShieldCheck size={23} /><div><strong>מרחב עבודה נפרד לפרויקט החדש</strong><p>קריאת נתונים קיימים מהמערכת וטעינת קבצים מקומית. שינויי נתונים בפרודקשן חסומים בסנדבוקס.</p></div></section>
    {(error || loadError) && <div role="alert" className="sb-error">{error || loadError}</div>}
    <div className="sb-data-grid"><section className="panel sb-source-card"><div className="sb-card-title"><CloudDownload /><h2>הנתונים שכבר במערכת</h2></div><p>התחברות עם אותו חשבון NETWORTH, כדי להציג את התיק הקיים בעיצוב החדש.</p>
      {!auth ? <form onSubmit={login} className="sb-login"><label>מספר טלפון<input type="tel" inputMode="tel" required value={phone} onChange={e => { setPhone(e.target.value); setSent(false); }} placeholder="05X-XXXXXXX" autoComplete="tel" /></label>{sent && <label>קוד האימות<input inputMode="numeric" required autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} placeholder="הקוד שנשלח ב־SMS" /></label>}<button className="primary" disabled={working || busy}><LogIn size={16} />{working ? 'מתחבר…' : sent ? 'אימות וטעינת התיק' : 'שליחת קוד כניסה ב־SMS'}</button><small>אותו מנגנון כניסה קיים. החיבור נשמר בזיכרון הלשונית עד לרענון.</small></form> : <div className="sb-connected"><strong>מחובר: {auth.name}</strong><div className="sb-button-row"><button className="primary small" disabled={busy || working} onClick={() => onLoad('', auth.name)}><RefreshCw size={15} />טעינת התיק שלי</button><button className="outline" onClick={() => { onLogout(); setClients([]); setUploads([]); setCandidates([]); }}><LogOut size={15} />ניתוק</button></div><hr /><h3>תצוגת לקוח למנהל</h3><p>רשימת הלקוחות זמינה רק אם השרת מאשר הרשאת מנהל.</p><button className="outline" disabled={working || busy} onClick={() => run(async () => setClients(await request('/admin/clients')))}>טעינת רשימת הלקוחות</button>{clients.length > 0 && <><label>בחר לקוח<select value={clientId} onChange={e => setClientId(e.target.value)}><option value="">בחר לקוח</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><button className="primary" disabled={!clientId || busy} onClick={() => onLoad(clientId, clients.find(c => c.id === clientId)?.name)}>הצג בעיצוב החדש</button></>}
      <button className="text-link sb-raw-link" disabled={working || busy} onClick={() => run(async () => setUploads(await request('/admin/raw-uploads')))}>טעינת קבצי המקור שכבר הועלו</button>
      {uploads.length > 0 && <div className="sb-upload-list">{uploads.map(file => <button key={file.id} disabled={working || busy} onClick={() => run(async () => {
        const buffer = await request(`/admin/raw-uploads/${file.id}/file`, { binary: true });
        const fileLike = { name: file.filename, arrayBuffer: async () => buffer, text: async () => new TextDecoder('utf-8').decode(buffer) };
        const result = await parseSource(fileLike);
        if (!result.length) throw new Error('לא נמצאו נתונים בקובץ המקור');
        finishImport(result);
      })}><FileUp size={15} /><span>{file.filename}<small>{file.user_name || 'קובץ מרוכז'} · פענוח מקומי בלבד</small></span></button>)}</div>}
      </div>}
    </section><section className="panel sb-source-card"><div className="sb-card-title"><FileUp /><h2>קבצי מסלקה והר הביטוח</h2></div><p>אותם פרסרים של המערכת המקורית. בחר קבצים מהמחשב או טען קובץ מקור שמור — הפענוח מתבצע בדפדפן.</p><label className="sb-dropzone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); parse([...e.dataTransfer.files]); }}><FileUp size={32} /><strong>{importing ? 'מפענח את הקבצים…' : 'בחירת קבצים או גרירה לכאן'}</strong><span>ZIP / XML של המסלקה · Excel של הר הביטוח</span><input aria-label="קבצי מסלקה והר הביטוח" type="file" accept=".zip,.xml,.xls,.xlsx" multiple disabled={importing || busy} onChange={e => { parse([...e.target.files]); e.target.value = ''; }} /></label>{importing && <p role="status" className="sb-import-progress">מפענח את הקבצים ומכין את התיק להצגה…</p>}{importError && <div role="alert" className="sb-error">{importError}</div>}<small>תיק יחיד מוצג מיד. קבצים של אותו לקוח מתמזגים עם התיק הטעון.</small><small>אין העלאה לשרת, אין שמירה בתיק הלקוח ואין שליחת הודעות.</small><div className="sb-demo-source"><FlaskConical /><div><h3>רוצים לבדוק את העיצוב?</h3><p>אפשר לעבוד גם עם תיק דוגמה, בלי להתחבר.</p></div><button className="outline" disabled={busy} onClick={onDemo}>תיק הדגמה</button></div></section></div>
    {candidates.length > 0 && <section ref={resultsRef} className="panel sb-source-card sb-import-results"><p role="status" className="sb-import-progress">{importNotice}</p><h2>בחר את התיק להצגה</h2><p>החלפת התיק מנקה את התצוגה הקודמת. מיזוג מתאפשר רק עם מזהה לקוח תואם.</p>{candidates.map((candidate, index) => {
      const same = isSameClient(candidate);
      const p = portfolio(candidate);
      return <div className="sb-candidate" key={index}><span><strong>{candidate.label}</strong><small>{p.funds.length} מוצרי חיסכון · {p.policies.length} פוליסות</small></span><div className="sb-button-row"><button className="primary small" disabled={busy} onClick={() => apply(candidate)}>החלפת התיק והצגה</button>{same && <button className="outline" disabled={busy} onClick={() => apply(candidate, true)}>מיזוג לאותו לקוח</button>}</div></div>;
    })}</section>}
    <section className="panel sb-integrations"><h2>החיבורים של NETWORTH בסנדבוקס</h2><div className="sb-integration-grid">{[['נתוני לקוחות', 'תיקים, פרופילים וקבצים שמורים · API קיים'], ['מסלקה והר הביטוח', 'פרסרים קיימים · פענוח מקומי'], ['פנסיה־נט וגמל־נט', 'נתוני מסלולים והשוואה · data.gov.il'], ['בדיקת דמי ניהול', 'רף בדיקה לפנסיה ותחזית פרישה'], ['תזרים ותקציב', 'קריאת הוצאות, הכנסות, קטגוריות ותקציב'], ['פרודקשן', 'כתיבה, מחיקה, ייבוא ושליחת התראות חסומים']].map(([name, text]) => <div key={name}><span className="sb-integrated-dot" /><strong>{name}</strong><small>{text}</small></div>)}</div><button className="text-link" disabled={working} onClick={() => run(async () => { const data = await request('/health'); setConnection(data.status === 'ok' ? 'שרת ה־API הקיים זמין.' : 'השרת הגיב; סטטוס הבריאות לא תקין.'); })}>בדיקת חיבור לשרת</button>{connection && <span className="sb-connection" role="status">{connection}</span>}</section>
  </div>;
}
