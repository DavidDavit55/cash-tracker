import {feeRecommendation} from '../lib/productReview';
export default function FeeReviewGroup({product,entries={},onChange,disabled}){
 const keys=['depositFee','balanceFee'];
 const changing=keys.some(k=>entries[k]?.status==='improve');
 const good=keys.every(k=>entries[k]?.status==='good');
 function update(status,key,value){
  const next={...entries};
  for(const k of keys)next[k]={status,note:'',...(status==='improve'?{proposedFee:k===key?value:entries[k]?.proposedFee??product.values?.[k]??''}:{})};
  for(const k of keys)next[k].note=feeRecommendation(k,next[k],product.values,next);
  onChange(next);
 }
 return <section className="pr-fee-group"><h3>דמי ניהול</h3><div className="pr-fee-choice"><button type="button" disabled={disabled} aria-pressed={good} onClick={()=>update('good')}>התנאים טובים</button><button type="button" disabled={disabled} aria-pressed={changing} onClick={()=>update('improve')}>הצעת תנאים חדשים</button></div><table><thead><tr><th></th><th>כיום</th>{changing&&<th>מוצע</th>}</tr></thead><tbody>{keys.map(k=><tr key={k}><th>{k==='depositFee'?'מהפקדה':'מצבירה'}</th><td>{product.values?.[k]!=null?`${product.values[k]}%`:'לא התקבל'}</td>{changing&&<td><input aria-label={`${k==='depositFee'?'מהפקדה':'מצבירה'} מוצע (%)`} type="number" inputMode="decimal" min="0" max="100" step="0.01" disabled={disabled} value={entries[k]?.proposedFee??''} onChange={e=>update('improve',k,e.target.value)}/><span> %</span></td>}</tr>)}</tbody></table>{changing?<small>אפשר להעלות מהפקדה ולהפחית מצבירה. ההשוואה ללקוח מחושבת לפי שני הרכיבים יחד.</small>:good?<p>מומלץ לשמור על התנאים הקיימים.</p>:<small>בחר אם להשאיר את התנאים או להציע שינוי.</small>}</section>;
}
