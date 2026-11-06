import ReviewEditor from './ReviewEditor';
import { useEffect, useState } from 'react';
import BrandLogo from './BrandLogo';
import SignaturePad from '../components/SignaturePad';
import { CONSENT_ITEMS, buildConsentText } from '../../sandbox/consents.mjs';
import { parseSource } from './parseSource';
import { dedupById } from './productIdentity';
import { isValidIsraeliId, normalizeIsraeliId } from '../lib/israeliId';
import SandboxApp from './SandboxApp';
import './workflow.css';

const adminMode = new URLSearchParams(location.search).has('admin');
const storageKey = adminMode ? 'sb-admin-session' : 'sb-client-session';
async function api(path, body) {
  const response = await fetch('/sandbox-workflow' + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem(storageKey) || ''}` }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'הפעולה נכשלה');
  return data;
}
const snapshotOf = client => ({ ...(client.financial || { pension_data: [], insurance_data: [], har_bituach_data: [], client_info: {} }), source: 'sandbox', displayName: client.name, review: client.review, profile: { phone: client.phone, name: client.name, birth_date: client.birth_date, id_number: client.id_number }, loadedAt: client.updatedAt });
export default function WorkflowApp() {
  const [status, setStatus] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState(Boolean(sessionStorage.getItem(storageKey))), [client, setClient] = useState(null);
  const [clients, setClients] = useState([]), [messages, setMessages] = useState([]), [configuration, setConfiguration] = useState([]);
  const [selected, setSelected] = useState(''), [preview, setPreview] = useState(null), [view, setView] = useState(null);
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState(1), [signature, setSignature] = useState(null), [consents, setConsents] = useState({}), [whatsappConsent, setWhatsappConsent] = useState(false);
  const [form, setForm] = useState({ name: '', id_number: '', birth_date: '', id_issue_date: '', marital_status: '', goals: '', risk_tolerance: '' });
  const [notify, setNotify] = useState(false), [notice, setNotice] = useState('');
  const run = async action => { setBusy(true); setError(''); try { await action(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const refresh = async () => {
    if (adminMode) { const data = await api('/admin/clients'); setClients(data.clients); setMessages(data.messages); setConfiguration(data.configuration); }
    else setClient((await api('/me')).client);
  };
  useEffect(() => { api('/status').then(setStatus).catch(e => setError(e.message)); }, []);
  useEffect(() => {
    if (!logged) return;
    let active = true;
    api(adminMode ? '/admin/clients' : '/me').then(data => {
      if (!active) return;
      if (adminMode) { setClients(data.clients); setMessages(data.messages); setConfiguration(data.configuration); } else setClient(data.client);
    }).catch(e => { if (active) { setError(e.message); setLogged(false); sessionStorage.removeItem(storageKey); } });
    return () => { active = false; };
  }, [logged]);
  const logout = () => { sessionStorage.removeItem(storageKey); setLogged(false); setClient(null); setView(null); };
  const field = (key, title, type = 'text') => <label>{title}<input required type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>;
  const selectedClient = clients.find(c => c.id === selected);
  async function parse(files) {
    setPreview(null); setNotice('');
    const parts = (await Promise.all([...files].map(parseSource))).flat();
    if (!parts.length || parts.some(p => normalizeIsraeliId(p.client_info?.id) !== selectedClient.id_number)) throw new Error('הקבצים חייבים להשתייך ללקוח שנבחר בלבד');
    const base = selectedClient.financial || { pension_data: [], insurance_data: [], har_bituach_data: [], client_info: {} };
    setPreview({ ...base, client_info: { ...base.client_info, ...parts[0].client_info }, ...Object.fromEntries(['pension_data', 'insurance_data', 'har_bituach_data'].map(k => [k, dedupById([...parts.flatMap(p => p[k]), ...base[k]])])) });
  }
  if (view) return <><div className="wf-return"><button onClick={() => setView(null)}>חזרה ל{adminMode ? 'דשבורד האדמין' : 'תיק שלי'}</button><span>תיק בדיקה מקומי</span></div><SandboxApp clientMode key={view.id} initialSnapshot={snapshotOf(view)} /></>;
  return <div className="wf" dir="rtl"><header><a href="/sandbox.html" aria-label="NETWORTH — דף הבית"><BrandLogo /></a><span>סנדבוקס · הרשמה וניהול תיקים</span><nav><a href="/sandbox.html?register">כניסת לקוח</a><a href="/sandbox.html?admin">דשבורד אדמין</a>{logged && <button onClick={logout}>יציאה</button>}</nav></header>
    <main><div className="wf-banner">נתוני הבדיקה נשמרים במחשב הזה בנפרד מהפרודקשן. כניסה מקומית ללא אימות SMS. הודעות WhatsApp נשלחות בפועל.</div>
      {error && <p className="wf-error" role="alert">{error}</p>}{notice && <p role="status" className="wf-success">{notice}</p>}
      {adminMode ? <>
        <h1>דשבורד האדמין</h1><p>מההרשמה ועד שהתמונה הפיננסית מוכנה ללקוח.</p>
        {!logged ? <form className="wf-card wf-narrow" onSubmit={e => { e.preventDefault(); run(async () => { const data = await api('/local-login', { phone, role: 'admin' }); sessionStorage.setItem(storageKey, data.token); setLogged(true); }); }}><h2>כניסת אדמין</h2><p>בסנדבוקס נכנסים ללא SMS, עם מספר הטלפון של האדמין שמוגדר במערכת.</p><label>מספר הטלפון שלך<input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="05X-XXXXXXX" /></label><button disabled={busy || !status?.adminConfigured}>{busy ? 'רגע…' : 'כניסה לדשבורד'}</button></form> : <>
          <div className="wf-metrics"><div><b>{clients.length}</b>נרשמים</div><div><b>{clients.filter(c => !c.financial).length}</b>ממתינים לנתונים</div><div><b>{clients.filter(c => c.financial).length}</b>תיקים עם נתונים</div></div>
          <details className="wf-card"><summary>מצב חיבור ההודעות</summary>{configuration.map(c => <p key={c.name}>{c.ready ? '✓' : 'חסר'} {c.name}</p>)}<p>הסנדבוקס משתמש בשלוש התבניות הקיימות ב־Twilio. אין בהן קישור כניסה; אחרי קבלת ההודעה פותחים את כניסת הלקוח המקומית.</p></details>
          <div className="wf-admin-grid"><section className="wf-card"><div className="wf-spread"><h2>לקוחות</h2><button disabled={busy} onClick={() => run(refresh)}>רענון</button></div>{!clients.length && <p>עוד אין נרשמים. פתחו את כניסת הלקוח והשלימו את ההרשמה.</p>}{clients.map(c => <button className={`wf-client ${selected === c.id ? 'chosen' : ''}`} key={c.id} onClick={() => { setSelected(c.id); setPreview(null); setNotice(''); }}><strong>{c.name}</strong><span dir="ltr">{c.phone}</span><small>{c.financial ? 'נתונים הועלו' : 'ממתין לנתונים'} · נחתם {new Date(c.signedAt).toLocaleString('he-IL')}</small></button>)}</section>
          <section className="wf-card">{selectedClient ? <><h2>{selectedClient.name}</h2><p>ת.ז. {selectedClient.id_number}</p><details><summary>אישורים וחתימה</summary><p>מועד חתימה: {new Date(selectedClient.signedAt).toLocaleString('he-IL')}</p>{selectedClient.consents.map(c => <details key={c.key}><summary>✓ {c.title}</summary><p>{c.text}</p></details>)}<img className="wf-signature" src={selectedClient.signature} alt="חתימת הלקוח" /><p>אישור הודעות שירות בוואטסאפ: {selectedClient.whatsappConsent ? 'התקבל' : 'לא ניתן'}</p><button onClick={() => window.print()}>הדפסה / שמירה כ־PDF</button></details><hr /><h3>העלאת נתונים לתיק</h3><p>בחרו מסלקה ו/או הר ביטוח. הנתונים מפוענחים מקומית ונבדקת התאמה לתעודת הזהות.</p><input aria-label="קבצי נתונים ללקוח" type="file" multiple accept=".zip,.xml,.xlsx,.xls" disabled={busy} onChange={e => { const files = e.target.files; if (files.length) run(() => parse(files)); e.target.value = ''; }} />{preview && <><p>מוכנים לשמירה: {preview.pension_data.length} מוצרי חיסכון, {preview.insurance_data.length + preview.har_bituach_data.length} רשומות ביטוח.</p><label className="wf-check"><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />שליחת WhatsApp ללקוח לאחר השמירה</label><button disabled={busy} onClick={() => run(async () => { await api(`/admin/clients/${selectedClient.id}/data`, { snapshot: preview, notify }); setPreview(null); setNotice('הנתונים נשמרו. אפשר לבדוק את מצב ההודעה ביומן.'); await refresh(); })}>שמירת הנתונים {notify ? 'ועדכון הלקוח' : ''}</button></>}{selectedClient.financial && <ReviewEditor key={selectedClient.id + selectedClient.updatedAt} client={selectedClient} save={async draft => { await api(`/admin/clients/${selectedClient.id}/review`, draft); await refresh(); }} />}{selectedClient.financial && <button onClick={() => setView(selectedClient)}>צפייה בדשבורד הלקוח</button>}</> : <p>בחרו לקוח כדי לראות אישורים ולהעלות נתונים.</p>}</section></div>
          <section className="wf-card"><div className="wf-spread"><h2>יומן הודעות</h2><button disabled={busy} onClick={() => run(async () => { await api('/admin/messages/refresh', {}); await refresh(); })}>בדיקת סטטוס מסירה</button></div><table><thead><tr><th>לקוח</th><th>אירוע</th><th>מצב</th><th>זמן</th><th>שגיאה</th></tr></thead><tbody>{messages.map(m => <tr key={m.id}><td>{clients.find(c => c.id === m.clientId)?.name}</td><td>{{ welcome: 'ברוכים הבאים ללקוח', admin: 'נרשם חדש לאדמין', data: 'הנתונים מוכנים' }[m.kind]}</td><td>{m.status}</td><td>{new Date(m.at).toLocaleString('he-IL')}</td><td>{m.error || '—'}</td></tr>)}</tbody></table>{!messages.length && <p>טרם נשלחו הודעות.</p>}</section>
        </>}
      </> : <>
        <h1>כל התמונה הפיננסית שלך, במקום אחד</h1><p>פרטים, היכרות ואישורים — ואז נכין את התיק שלך.</p>
        {!logged ? <form className="wf-card wf-narrow" onSubmit={e => { e.preventDefault(); run(async () => { const data = await api('/local-login', { phone }); sessionStorage.setItem(storageKey, data.token); setLogged(true); }); }}><h2>מתחילים עם הטלפון שלך</h2><p>בבדיקה המקומית ממשיכים ללא קוד SMS.</p><label>מספר טלפון<input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="05X-XXXXXXX" /></label><button disabled={busy || !status}>{busy ? 'רגע…' : 'ממשיכים'}</button></form>
          : client ? <section className="wf-card wf-narrow"><button type="button" disabled={busy} onClick={() => run(async () => { const data = await api('/admin/from-client', {}); sessionStorage.setItem('sb-admin-session', data.token); window.location.href = '/sandbox.html?admin'; })}>כניסת אדמין עם המספר המחובר</button><h2>{client.financial ? 'התמונה שלך מוכנה' : 'ההרשמה הושלמה'}</h2><p>שלום {client.name}, {client.financial ? 'הנתונים שלך זמינים לצפייה.' : 'האישורים והחתימה נשמרו. כשהנתונים יועלו לתיק נעדכן אותך בוואטסאפ.'}</p><button disabled={busy} onClick={() => run(refresh)}>בדיקת עדכון</button>{client.financial && <button onClick={() => setView(client)}>לתמונה שלי</button>}</section>
            : <form className="wf-card wf-narrow" onSubmit={e => { e.preventDefault(); if (step < 3) { if (step === 1 && !isValidIsraeliId(form.id_number)) { setError('תעודת הזהות אינה תקינה. בדוק את כל הספרות.'); return; } if (step === 1 && (!Number.isFinite(Date.parse(form.birth_date)) || new Date(form.birth_date) >= new Date())) { setError('יש להזין תאריך לידה תקין בעבר.'); return; } setError(''); setStep(step + 1); } else run(async () => { const data = await api('/register', { ...form, consents, signature, whatsappConsent }); setClient(data.client); }); }}><div className="wf-steps">{['פרטים אישיים', 'מה חשוב לך', 'אישורים וחתימה'].map((s, i) => <span key={s} className={step === i + 1 ? 'active' : ''}>{i + 1}. {s}</span>)}</div>
              {step === 1 && <><h2>נעים להכיר</h2>{field('name', 'שם מלא')}{field('id_number', 'תעודת זהות')}{field('birth_date', 'תאריך לידה', 'date')}{field('id_issue_date', 'תאריך הנפקת תעודת זהות', 'date')}<label>מצב משפחתי<select required value={form.marital_status} onChange={e => setForm({ ...form, marital_status: e.target.value })}><option value="">בחירה</option>{['רווק/ה', 'נשוי/אה', 'גרוש/ה', 'אלמן/ה'].map(v => <option key={v}>{v}</option>)}</select></label></>}
              {step === 2 && <><h2>מה חשוב לך?</h2><label>מטרה עיקרית<select required value={form.goals} onChange={e => setForm({ ...form, goals: e.target.value })}><option value="">בחירה</option>{['חיסכון לפרישה', 'סדר בפנסיה ובביטוחים', 'רכישת דירה', 'ביטחון כלכלי'].map(v => <option key={v}>{v}</option>)}</select></label><label>הגישה שלך לסיכון<select required value={form.risk_tolerance} onChange={e => setForm({ ...form, risk_tolerance: e.target.value })}><option value="">בחירה</option>{['מעדיף יציבות', 'מוכן לתנודות מתונות', 'מוכן לתנודות משמעותיות לטווח ארוך'].map(v => <option key={v}>{v}</option>)}</select></label></>}
              {step === 3 && <><h2>אישורים וחתימה</h2><p>ההרשאות מוצגות בנוסח הקיים במערכת. יש לקרוא ולאשר בעצמך. החתימה נשמרת בתיק הבדיקה המקומי.</p>{CONSENT_ITEMS.map(item => <div className="wf-consent" key={item.key}><details><summary>{item.title}</summary><p>{buildConsentText(item.key, form.name, form.id_number)}</p></details><label className="wf-check"><input type="checkbox" required checked={Boolean(consents[item.key])} onChange={e => setConsents({ ...consents, [item.key]: e.target.checked })} />קראתי ואני מאשר/ת את ההרשאה</label></div>)}<label className="wf-check"><input type="checkbox" checked={whatsappConsent} onChange={e => setWhatsappConsent(e.target.checked)} />אני מסכים/ה לקבל בוואטסאפ הודעות שירות על ההרשמה וזמינות הנתונים (רשות).</label><h3>החתימה שלך</h3><p className="wf-sign-hint">יש לחתום עם העכבר או האצבע בתוך המסגרת המסומנת.</p><SignaturePad onChange={setSignature} /></>}
              <p className="wf-sign-hint" role="status">{step === 3 ? signature ? 'החתימה נקלטה' : 'נדרשת חתימה במסגרת כדי לסיים את ההרשמה' : ''}</p>{error && <p className="wf-inline-error" role="alert">{error}</p>}<div className="wf-actions"><button disabled={busy || (step === 3 && !signature)}>{busy ? 'שומרים…' : step === 3 ? 'אישור וסיום ההרשמה' : 'ממשיכים'}</button>{step > 1 && <button type="button" onClick={() => { setSignature(null); setConsents({}); setWhatsappConsent(false); setStep(step - 1); }}>חזרה</button>}</div>
            </form>}
      </>}
    </main></div>;
}
