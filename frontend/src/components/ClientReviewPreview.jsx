import ClientFeePreview from './ClientFeePreview';
import {reviewProducts} from '../lib/productReview';
export default function ClientReviewPreview({data,review}) {
 const products=reviewProducts(data).filter(p=>p.scope!=='portfolio');
 return <section><h2>ההמלצות שלך מ־NETWORTH</h2><p>סוכן מטפל: {review?.agentName||'דוד דויטשוילי'}</p>{products.map(p=>{
  const entries=review?.assessments?.[p.key]||{};
  const fees=['depositFee','balanceFee'];
  if(!fees.some(k=>['good','improve'].includes(entries[k]?.status)))return <p key={p.key}>{p.name}: טרם הושלמה בדיקת דמי הניהול.</p>;
  const proposed=k=>entries[k]?.status==='improve'?entries[k].proposedFee:entries[k]?.status==='good'?p.values[k]:undefined;
  const offer={deposit:proposed('depositFee'),balance:proposed('balanceFee')};
  const complete=fees.every(k=>proposed(k)!==undefined&&proposed(k)!==null&&proposed(k)!=='');
  const changed=fees.some(k=>entries[k]?.status==='improve');
  const tradeoff=complete&&Number(offer.deposit)>Number(p.values.depositFee)&&Number(offer.balance)<Number(p.values.balanceFee);
  const fund=data.pension_data?.find(f=>String(f.id??'')===p.number&&String(f.provider||'')===p.provider);
  return <article className="af-results" key={p.key}><h3>{p.name}</h3><h2>{changed?'הצעה לשינוי דמי הניהול':'דמי הניהול שלך נבדקו ונמצאו טובים'}</h2>{tradeoff&&<p>בהצעה הזו תשלמי יותר על כל הפקדה, ופחות על החיסכון שכבר נצבר. ההשוואה בשקלים למטה מביאה בחשבון את שני השינויים יחד.</p>}<table><thead><tr><th>דמי ניהול</th><th>כיום</th><th>מוצע</th></tr></thead><tbody>{fees.map(k=><tr key={k}><th>{k==='depositFee'?'מהפקדה':'מצבירה'}</th><td>{p.values[k]!=null?`${p.values[k]}%`:'לא התקבל'}</td><td>{proposed(k)!=null&&proposed(k)!==''?`${proposed(k)}%`:'טרם הוזן'}</td></tr>)}</tbody></table>{!changed?<p>מומלץ לשמור על התנאים הקיימים.</p>:complete&&fund?<ClientFeePreview fund={fund} birth={data.client_info?.birth} offer={offer}/>:<p>ההשוואה בשקלים תוצג לאחר השלמת שני שיעורי דמי הניהול.</p>}</article>;
 })}{review?.text&&<p>{review.text}</p>}</section>;
}
