import {bankLabels} from '../lib/budgetBank';
export default function BudgetBankPanel({rows,onEdit}){
 const excluded=rows.filter(r=>!r.ledger_id);
 return <details className="bw-panel bw-excluded"><summary><strong>תנועות שלא בתזרים</strong><span> · {excluded.length} תנועות</span></summary>
 <p>תנועות שאינן נכללות בחישוב ההכנסות וההוצאות בחודש הנבחר.</p>
 {excluded.length?<div className="bw-scroll"><table><thead><tr><th>תאריך</th><th>תיאור</th><th>סכום</th><th>סוג</th><th>פעולה</th></tr></thead><tbody>{excluded.map(r=><tr key={r.id}><td>{r.date?.split('-').reverse().join('/')}</td><td>{r.label}</td><td>{Number(r.amount).toLocaleString('he-IL')} ₪</td><td>{bankLabels[r.classification]}</td><td><button className="bw-link" onClick={()=>onEdit({...r,bank:true})}>עריכה</button></td></tr>)}</tbody></table></div>:<p>אין תנועות שלא בתזרים בחודש הזה.</p>}
 </details>;
}
