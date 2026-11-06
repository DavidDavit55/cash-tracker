import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../api/client';
import { filesFromUploads, processMaslakaFiles } from '../lib/maslakaCards';
import { parseHarBituach, groupHarBituachByPolicy } from '../lib/harBituachParser';
import { normalizeIsraeliId } from '../lib/israeliId';
import { onlyDate } from '../lib/reportMetadata';
import ReportHistory, { ReportProducts } from './ReportHistory';

export default function ReportImport() {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [source, setSource] = useState('maslaka');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => { api.get('/admin/clients').then(({ data }) => setClients(data)).catch(() => setMessage('טעינת הלקוחות נכשלה')); }, []);

  async function inspect(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setBusy(true); setMessage(''); setPreview(null);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('מגבלת הקובץ היא 20MB');
      let payload, subjectId, asOfDate = '', issuedOn = '';
      if (source === 'maslaka') {
        const files = await filesFromUploads([file]);
        const xml = files.map(f => new DOMParser().parseFromString(f.text, 'text/xml'));
        if (!xml.length || xml.some(d => d.querySelector('parsererror'))) throw new Error('אין דוחות XML תקינים בקובץ');
        const values = tag => xml.flatMap(d => [...d.getElementsByTagName(tag)].map(e => e.textContent.trim()).filter(Boolean));
        const ids = [...new Set(values('MISPAR-ZIHUY-LAKOACH').map(normalizeIsraeliId))];
        if (ids.length !== 1) throw new Error('בשלב זה יש להעלות דוח של לקוח אחד בלבד');
        subjectId = ids[0];
        const result = processMaslakaFiles(files, { includeEmptyAccounts: true });
        if (values('MISPAR-POLISA-O-HESHBON').length !== result.pensionCards.length + result.insuranceCards.length) throw new Error('מספר החשבונות שנקראו אינו תואם למקור. הדוח לא יישמר עד לבדיקת הקובץ.');
        payload = { pensionData: result.pensionCards, insuranceData: result.insuranceCards };
        asOfDate = onlyDate(values('TAARICH-NECHONUT'));
        issuedOn = onlyDate(values('TAARICH-BITZUA'));
      } else {
        const buffer = await file.arrayBuffer();
        const rows = parseHarBituach(buffer);
        const ids = [...new Set(rows.map(r => normalizeIsraeliId(r.tz)))];
        if (ids.length !== 1) throw new Error('בשלב זה יש להעלות דוח של לקוח אחד בלבד');
        subjectId = ids[0];
        const companies = [...new Set(rows.map(r => r.company))];
        payload = { harBituachData: companies.flatMap(company => groupHarBituachByPolicy(rows.filter(r => r.company === company))) };
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        asOfDate = onlyDate(Object.entries(sheet).filter(([key]) => /^[A-Z]+[123]$/.test(key)).map(([, cell]) => cell.w || cell.v));
        issuedOn = asOfDate;
      }
      if (!Object.values(payload).some(rows => rows.length)) throw new Error('לא נמצאו מוצרים בדוח');
      const client = clients.find(c => c.id_number && normalizeIsraeliId(c.id_number) === subjectId);
      if (!client || (clientId && client.id !== clientId)) throw new Error('תעודת הזהות בדוח אינה תואמת ללקוח שנבחר או שאינה רשומה במערכת');
      setClientId(client.id);
      setPreview({ file, payload, subjectId, source, asOfDate, issuedOn });
    } catch (error) { setMessage(error.message || 'קריאת הדוח נכשלה'); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!preview) return;
    setBusy(true); setMessage('');
    try {
      const form = new FormData(); form.append('file', preview.file);
      form.append('report', JSON.stringify({ source: preview.source, subjectId: preview.subjectId, asOfDate: preview.asOfDate, issuedOn: preview.issuedOn, ...preview.payload }));
      await api.post(`/admin/clients/${clientId}/reports`, form);
      setPreview(null); setRevision(r => r + 1);
      setMessage('הדוח וקובץ המקור נשמרו בהיסטוריה בלבד. התיק הנוכחי וההמלצות לא השתנו.');
    } catch (error) { setMessage(error.response?.data?.error || 'שמירת הדוח נכשלה — אפשר לנסות שוב'); }
    finally { setBusy(false); }
  }

  return <><section className="card report-history" dir="rtl"><h3>קליטת דוח עם תצוגה מקדימה</h3>
    <p>בחירת קובץ אינה שומרת דבר. אחרי בדיקה ואישור, הקובץ יישמר כדוח היסטורי נפרד — ללא עדכון התיק הנוכחי וללא שליחת הודעה ללקוח.</p>
    <label>לקוח<select aria-label="לקוח לדוח" disabled={busy} value={clientId} onChange={e => { setClientId(e.target.value); setPreview(null); setMessage(''); }}><option value="">זיהוי לפי תעודת זהות בקובץ</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>מקור<select aria-label="מקור הדוח" disabled={busy} value={source} onChange={e => { setSource(e.target.value); setPreview(null); setMessage(''); }}><option value="maslaka">מסלקה</option><option value="har_bituach">הר הביטוח</option></select></label>
    <label>קובץ מקור אחד (ZIP / XML למסלקה, Excel להר הביטוח)<input disabled={busy || !clients.length} type="file" accept={source === 'maslaka' ? '.zip,.xml' : '.xlsx,.xls'} onChange={inspect} /></label>
    {busy && <p role="status">מעבד…</p>}{message && <p role="status">{message}</p>}
    {preview && <div><h4>תצוגה מקדימה — {preview.file.name}</h4><p>לקוח מזוהה: {clients.find(c => c.id === clientId)?.name}</p>
      <p>בדוק את התאריכים מול המקור. אם לא נמצא תאריך יחיד, השדה נשאר ריק ולא נבחר תאריך אוטומטית.</p>
      <label>הנתונים נכונים ל־<input type="date" disabled={busy} required value={preview.asOfDate} onChange={e => setPreview(p => ({ ...p, asOfDate: e.target.value }))} /></label>
      <label>תאריך הפקת הדוח (אם ידוע)<input type="date" disabled={busy} value={preview.issuedOn} onChange={e => setPreview(p => ({ ...p, issuedOn: e.target.value }))} /></label>
      <p>מועד הקליטה יירשם אוטומטית בעת השמירה.</p><ReportProducts report={preview} />
      <button className="btn-primary" disabled={busy || !preview.asOfDate} onClick={save}>אישור ושמירה בהיסטוריה בלבד</button>
      <button disabled={busy} onClick={() => setPreview(null)}>ביטול</button>
    </div>}
  </section>{clientId && <ReportHistory clientId={clientId} revision={revision} />}</>;
}
