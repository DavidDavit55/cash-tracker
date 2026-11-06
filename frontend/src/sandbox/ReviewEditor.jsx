import ProductReview from '../components/ProductReview';
import { reviewProducts, validateAssessments } from '../lib/productReview';
import { useState, useEffect } from 'react';

export default function ReviewEditor({ client, save, onDraftChange }) {
  const [text, setText] = useState(client.reviewDraft?.text || client.review?.text || '');
  const [agentName, setAgentName] = useState(client.reviewDraft?.agentName || client.review?.agentName || '');
  const products = reviewProducts(client);
  const [assessments, setAssessments] = useState(client.reviewDraft?.assessments || client.review?.assessments || {});
  useEffect(()=>{onDraftChange?.({text,agentName,assessments});},[text,agentName,assessments,onDraftChange]);
  const hasAssessment = Object.values(assessments).some(entries => Object.values(entries).some(e => e.status !== 'unchecked'));
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function submit(publish) {
    setBusy(true); setMessage('');
    try {
      const checked = validateAssessments(assessments, products, publish);
      const result = await save({ text, agentName, assessments: checked, publish, version: client.updatedAt });
      const notification = result?.notification;
      const delivery = notification?.status === 'accepted' ? 'הודעת WhatsApp הועברה לשירות השליחה; המסירה ללקוח טרם אומתה.'
        : notification?.status === 'failed' ? 'שליחת הודעת WhatsApp נכשלה.'
        : notification?.reason === 'demo' ? 'זהו דמו מקומי; לא נשלחה הודעה.'
        : notification?.reason === 'admin' ? 'לא נשלחה הודעת לקוח לחשבון אדמין.'
        : notification?.reason === 'missing_phone' ? 'לא נשלחה הודעה: חסר מספר טלפון ללקוח.'
        : notification?.reason === 'missing_configuration' ? 'לא נשלחה הודעה: חסרה הגדרה בשירות השליחה.'
        : 'לא התקבל אישור משירות השליחה.';
      setMessage(publish ? `ההמלצות פורסמו באזור האישי. ${delivery}` : 'הטיוטה נשמרה ואינה גלויה ללקוח.');
    }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <section className="pr-editor"><h3>המלצות הסוכן</h3><p>בדוק כל מוצר ופרמטר. הטיוטה נשמרת בנפרד; רק אישור ופרסום מציגים את הממצאים ללקוח.</p><label>שם הסוכן<input value={agentName} onChange={e => setAgentName(e.target.value)} maxLength={120} /></label><ProductReview products={products} assessments={assessments} onChange={setAssessments} disabled={busy}/><label>סיכום כללי ללקוח (אופציונלי כשיש בדיקת מוצרים)<textarea rows={7} value={text} onChange={e => setText(e.target.value)} maxLength={20000} /></label><div className="wf-actions"><button disabled={busy || (!text.trim() && !hasAssessment) || !agentName.trim()} onClick={() => submit(false)}>שמירת טיוטה</button><button disabled={busy || (!text.trim() && !hasAssessment) || !agentName.trim()} onClick={() => submit(true)}>אישור ופרסום ללקוח</button></div><p role="status">{message}</p>{client.review?.publishedAt && <small>פרסום אחרון: {new Date(client.review.publishedAt).toLocaleString('he-IL')}</small>}</section>;
}
