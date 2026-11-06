import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { money, birthDate } from './model';
import { feeProjection } from './feeProjection';

export default function FeeComparison({ fund, snapshot }) {
  const { data, months, monthly, latest, saving, benchmark } = feeProjection(snapshot.source === 'demo' ? { ...fund, monthlyDepositVerified: true } : fund, birthDate(snapshot));
  const last = data.at(-1);
  return <section className="panel sb-fee-comparison">
    <h3>השוואת דמי הניהול עד גיל 67</h3>
    {last ? <>
      <div className="sb-return-insight"><strong>{saving === 0 ? 'אין הבדל צפוי בין התרחישים' : `${money(Math.abs(saving))} ${saving > 0 ? 'יותר' : 'פחות'} בחיסכון בתרחיש ההשוואה`}</strong><p>המחשה באותם תנאי חיסכון ותשואה; זו אינה הצעה מאושרת.</p></div>
      <div className="sb-fee-inputs"><p><b>דמי הניהול שלך היום</b><br />{fund.feeFromDeposit}% מהפקדה · {fund.feeFromAccumulation}% מצבירה</p><p><b>דמי ניהול להשוואה</b><br />{benchmark.feeFromDeposit}% מהפקדה · {benchmark.feeFromAccumulation}% מצבירה</p></div>
      <div className="sb-fee-forecast" dir="ltr"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 15, right: 14, bottom: 25, left: 5 }}><CartesianGrid stroke="#e3ece5" vertical={false} /><XAxis type="number" domain={[0, 'dataMax']} dataKey="year" label={{ value: 'שנים מהיום', position: 'bottom', offset: 5 }} /><YAxis width={66} tickFormatter={v => `${Math.round(v / 1000)} אלף`} /><Tooltip labelFormatter={v => `בעוד ${Math.floor(v)} שנים ו־${Math.round((v % 1) * 12)} חודשים`} formatter={(v, name) => [money(v), name]} /><Legend verticalAlign="top" height={48} /><Line name="דמי הניהול שלך היום" type="monotone" dataKey="current" stroke="#173f35" strokeWidth={3} dot={false} /><Line name="דמי ניהול להשוואה" type="monotone" dataKey="alternative" stroke="#b69a58" strokeWidth={3} strokeDasharray="7 3" dot={false} /></LineChart></ResponsiveContainer></div>
      <div className="sb-fee-inputs"><p>צבירה בתנאים הנוכחיים: <b>{money(last.current)}</b></p><p>צבירה בתרחיש ההשוואה: <b>{money(last.alternative)}</b></p></div>
    </> : <p role="status">אין מספיק נתונים תקינים לחישוב תחזית עד גיל 67.</p>}
    <details className="sb-fee-assumptions"><summary>על מה מבוסס החישוב?</summary><p>צבירה: {money(fund.balance)} · הפקדה חודשית: {money(monthly)}{latest?.month ? ` (חודש שכר ${latest.month})` : ''}</p><p>זמן לחישוב: {months == null ? 'תאריך לידה חסר או לא תקין' : `${Math.floor(months / 12)} שנים ו־${months % 12} חודשים מלאים עד גיל 67`}.</p><p>תשואה שנתית משוערת של 4% בשני התרחישים, הפקדה קבועה באמצע כל חודש, ללא ניודים. החישוב אינו כולל עלויות ביטוח, מס או אינפלציה. בסיס ההשוואה אינו ממוצע שוק או הבטחה. חודש חלקי אחרון אינו נכלל.</p></details>
  </section>;
}
