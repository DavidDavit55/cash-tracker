import React from 'react';
import {policyDisplay} from '../frontend/src/lib/crmDisplay.js';
export default function TransferContext({d,p={}}){
 const balance=d.sourceBalance??p.balance,asOf=d.sourceAsOf||p.asOf;
 const knownBalance=balance!==null&&balance!==undefined&&balance!==''&&Number.isFinite(Number(balance));
 return <aside className="wf-current-recommendation" aria-label="מקור ויעד הניוד">
 <h3>מאיפה מניידים?</h3>
 <p><b>{p.company||'חברת המקור לא תועדה'}</b> · {p.name||p.category||'שם הקרן לא תועד'}</p>
 <p>חשבון / פוליסה במקור: <bdi>{p.policy?policyDisplay(p.policy):'לא תועד'}</bdi></p>
 <p>מצב קרן המקור: {d.transfer?.inactive===true?'לא פעילה':d.transfer?.inactive===false?'פעילה':'לא תועד'}</p>
 <p>צבירה אחרונה ידועה: {knownBalance?Number(balance).toLocaleString('he-IL')+' ₪':'לא דווחה'} · נכון ל־{asOf||'תאריך לא ידוע'}</p>
 <h3>לאן מניידים?</h3><p><b>{d.target||'חברת היעד לא תועדה'}</b> · {d.targetName||d.targetCategory||p.category||'סוג הקרן לא תועד'}</p>
 <p>חשבון ביעד: <bdi>{d.policy||'טרם תועד'}</bdi></p>
 <small>הצבירה במקור אינה סכום ניוד מאומת.{d.consolidationId?' מקור זה במעקב נפרד במסגרת איחוד קופות.':''}</small>
 </aside>;
}
