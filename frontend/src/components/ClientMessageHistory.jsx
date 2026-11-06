import { useEffect, useState } from 'react';
import api from '../api/client';
import './ClientMessageHistory.css';

const statuses = {
  accepted: ['התקבלה לשליחה', 'pending'], queued: ['ממתינה לשליחה', 'pending'],
  scheduled: ['מתוזמנת', 'pending'], sending: ['בשליחה', 'pending'],
  sent: ['נשלחה', 'sent'], delivered: ['נמסרה', 'delivered'], read: ['נקראה', 'read'],
  failed: ['השליחה נכשלה', 'failed'], undelivered: ['לא נמסרה', 'failed'], canceled: ['בוטלה', 'failed'],
};
const date = value => value ? new Date(value).toLocaleString('he-IL') : 'לא זמין';
export default function ClientMessageHistory({ clientId, revision }) {
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let current = true;
    api.get(`/admin/clients/${clientId}/messages`).then(({ data }) => {
      if (current) setState({ data, clientId, refresh, revision });
    }).catch(error => {
      if (current) setState({ error: error.response?.data?.error || 'טעינת ההודעות נכשלה', clientId, refresh, revision });
    });
    return () => { current = false; };
  }, [clientId, refresh, revision]);
  const loading = state.clientId !== clientId || state.refresh !== refresh || state.revision !== revision;
  const data = loading ? null : state.data;
  return <section className="card client-message-history" aria-label="הודעות WhatsApp ללקוח">
    <header><div><h3>הודעות WhatsApp ללקוח</h3><p>הודעות מהמספר העסקי וסטטוס המסירה האחרון שלהן.</p></div>
      <button type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)}>רענון סטטוסים</button></header>
    {loading ? <p role="status">טוען הודעות…</p> : state.error ? <p role="alert">{state.error}</p> : <>
      {data?.unavailable ? <p>{data.unavailable === 'missing_phone' ? 'לא שמור מספר טלפון ללקוח.' : 'שירות ההודעות אינו מוגדר כרגע.'}</p> : <>
        {!data?.messages.length && <p>לא נמצאו הודעות למספר הטלפון הנוכחי של הלקוח בשירות WhatsApp.</p>}
        <ol>{data?.messages.map(message => {
          const [label, kind] = statuses[message.status] || ['סטטוס לא ידוע', 'pending'];
          return <li key={message.id}><div className="client-message-meta"><time>{date(message.sentAt || message.createdAt)}</time><span className={`client-message-state client-message-${kind}`}>{label}</span></div>
            <p className="client-message-body">{message.body || 'תוכן ההודעה אינו זמין מהספק.'}</p>
            {message.mediaCount > 0 && <small>כוללת {message.mediaCount} קבצים מצורפים</small>}
            {message.errorCode && <small>קוד שגיאה: {message.errorCode}</small>}
          </li>;
        })}</ol>
        {data?.hasMore && <p>מוצגות 50 ההודעות האחרונות.</p>}
        <footer>עודכן: {date(data?.checkedAt)} · ״נקראה״ מוצג רק כאשר WhatsApp מספק אישור קריאה. התאריך הוא מועד השליחה, לא מועד הקריאה.</footer>
      </>}
    </>}
  </section>;
}
