import { useState } from 'react';
import { CalendarDays, MessageCircle, UserRound, Check, ArrowUpLeft } from 'lucide-react';
import { buildCalendlyLink } from '../mockData';

export default function ClientReview({ children, clientView = false, agentName }) {
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const [saved, setSaved] = useState(false);
  return <section className="client-review">
    {!clientView && <div className="cr-preview">תצוגת ניסיון בתוך התיק · הממצאים עדיין אוטומטיים, ולא פורסמו או אושרו על ידי סוכן.</div>}
    <div className="cr-welcome"><div><span className="cr-eyebrow">עוברים יחד על התמונה שלך</span><h2>מבינים את האפשרויות. מחליטים יחד.</h2><p>{clientView ? 'נקודות לבדיקה בתיק שלך — נעבור עליהן יחד עם הסוכן לפני שמחליטים על שינוי.' : 'כאן יופיעו ההמלצות שהסוכן יכין עבורך, עם אפשרות לשאול ולתאם שיחה לפני שמתקדמים.'}</p></div><span className="cr-seal"><UserRound size={26} />ליווי אישי</span></div>
    <div className="cr-layout"><div className="cr-content">{children}</div><aside className="cr-agent panel"><div className="cr-person"><span className="cr-avatar">ד</span><div><h3>{agentName || 'צוות NETWORTH'}</h3><p>{clientView ? 'ליווי אישי' : 'הסוכן המטפל · להמחשה'}</p></div></div><h3>נדבר על מה שחשוב לך</h3><p>נעבור על האפשרויות, נענה על השאלות ונחליט יחד מה הצעד הבא.</p><a className="primary" href={buildCalendlyLink()} target="_blank" rel="noreferrer"><CalendarDays size={18} />בחירת זמן לשיחה<ArrowUpLeft size={16} /></a>{!clientView && <button className="cr-question-button" onClick={() => { setAsking(!asking); setSaved(false); }}><MessageCircle size={18} />יש לי שאלה לפני השיחה</button>}{asking && <form onSubmit={e => { e.preventDefault(); setSaved(true); }}><label htmlFor="cr-question">מה היית רוצה להבין?</label><textarea id="cr-question" required value={question} onChange={e => { setQuestion(e.target.value); setSaved(false); }} placeholder="שאלה על המלצה או על משהו אחר בתיק…" /><button className="primary" type="submit">תצוגה מקדימה לשליחת שאלה</button><small role="status">{saved ? 'כך יופיע אישור קבלת השאלה. בתצוגת הניסיון לא נשלחה הודעה לסוכן.' : 'הטופס להדגמה בלבד; השאלה אינה נשלחת.'}</small></form>}{!clientView && <div className="cr-followup"><Check size={17} /><p>לא קבעת זמן? בתהליך המתוכנן הסוכן ייצור איתך קשר להמשך הטיפול.</p></div>}<small>שום שינוי במוצרים לא מתבצע מתוך צפייה בהמלצות.</small></aside></div>
  </section>;
}
