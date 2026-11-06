import { TrendingUp } from 'lucide-react';
import { comparableRows } from './recommendationRules';
import RecommendationIdentity from './RecommendationIdentity';
const pct = value => `${value.toFixed(2)}%`;
export default function PerformanceRecommendation({ fund, result, onOpen }) {
  const available = comparableRows(result.rows);
  const below = available.filter(row => row.own < row.group.average - 0.005).length;
  const above = available.filter(row => row.own > row.group.average + 0.005).length;
  const insight = available.length > 1 && below === available.length
    ? 'המסלול נמוך מממוצע הקבוצה בכל התקופות שניתן להשוות.'
    : available.length > 1 && above === available.length
      ? 'המסלול גבוה מממוצע הקבוצה בכל התקופות שניתן להשוות.'
      : below && above ? 'התמונה משתנה בין התקופות: בחלקן המסלול מעל הממוצע ובחלקן מתחתיו.' : null;
  return <article className="panel recommendation sb-performance">
    <div className="recommendation-head"><TrendingUp size={19} /><strong>כדאי לבחון את ביצועי המסלול לאורך זמן</strong></div>
    <div className="recommendation-body">
      <RecommendationIdentity fund={fund} showTrack />
      <div aria-live="polite">
        {insight && <h3>{insight}</h3>}
        {!result && <p>טוענים השוואת תשואות לשנה, ל־3 ול־5 שנים…</p>}
        {result?.error && <p>{result.error}</p>}
        {result?.rows && <><div className="sb-table-wrap"><table>
          <thead><tr><th>תקופה</th><th>המסלול שלך</th><th>ממוצע הקבוצה</th><th title="ההפרש בין התשואות בנקודות אחוז, ולא השינוי היחסי ביניהן">ביחס לממוצע</th></tr></thead>
          <tbody>{available.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{row.group && row.own != null ? <>
            <td>{pct(row.own)}</td><td>{pct(row.group.average)}<small>{row.group.byCompany.length} חברות</small></td>
            <td title="ההפרש בין התשואות בנקודות אחוז, ולא השינוי היחסי ביניהן">{Math.abs(row.own - row.group.average) < 0.005 ? 'ללא פער' : <><bdi dir="ltr">{Math.abs(row.own - row.group.average).toFixed(2)} נק׳ אחוז</bdi>{' '}{row.own < row.group.average ? 'מתחת לממוצע' : 'מעל הממוצע'}</>}</td>
          </> : <td colSpan={3}>{row.error ? 'הטעינה נכשלה' : 'אין מספיק נתונים להשוואה'}</td>}</tr>)}</tbody>
        </table></div><p className="sb-source-note">תשואה מצטברת עד {result.period.slice(4)}/{result.period.slice(0, 4)} · ממוצע פשוט של חברות עם נתונים מלאים באותה קטגוריה ובאותה תקופה. הרכב הקבוצה עשוי להשתנות בין התקופות. ההפרש מחושב לפני עיגול התשואות המוצגות.</p></>}
      </div>
      <p>כדאי לבחון את הפערים יחד עם רמת הסיכון ודמי הניהול. פער בשנה אחת לבדו אינו סיבה למעבר מסלול, ותשואות עבר אינן מבטיחות תשואות בעתיד.</p>
      <button className="outline" onClick={() => onOpen(fund)}>לפרטי המסלול</button>
    </div>
  </article>;
}
