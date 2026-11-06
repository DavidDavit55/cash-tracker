import {hasFeeChange} from './fee-change-agreement.js';
export function depositDifference(d){
 const f=d.transfer||{};
 const expected=Number(f.salary)*(Number(f.employee||0)+Number(f.employer||0)+Number(f.severance||0))/100;
 const actual=f.depositActual==null||f.depositActual===''?null:Number(f.depositActual);
 const gap=actual===null?0:Math.round((actual-expected)*100)/100;
 return {expected,actual,gap,open:expected>0&&actual!==null&&Math.abs(gap)>100&&!f.depositResolution?.trim()};
}
export function policyClassification(p){
 const value=[p.groupClassification,p.classification,p.policyClassification].filter(Boolean).join(' ');
 if(p.isCollective===true||/קבוצתי|קולקטיב/.test(value))return 'קבוצתי';
 if(p.isCollective===false||/אישי|פרט/.test(value))return 'אישי';
 return 'לא דווח';
}
export function agreedChanges(d){
 const includeFees=d.action!=='מינוי סוכן וביצוע השינויים שבסיכום'||hasFeeChange(d);
 return [d.allocations?.length?'מסלולי השקעה: '+d.allocations.map(a=>`${a.percent}% ${a.name} (${a.fundId})`).join(' · '):d.track?'מסלול השקעה: '+d.track:'',
 includeFees&&d.depositFee!=null&&d.depositFee!==''?'דמי ניהול מהפקדה: '+d.depositFee+'%':'',
 includeFees&&d.balanceFee!=null&&d.balanceFee!==''?'דמי ניהול מצבירה: '+d.balanceFee+'%':'',includeFees&&d.targetPremium!=null&&d.targetPremium!==''?'פרמיה חודשית: '+d.targetPremium+' ₪':'',d.changeDetails||''].filter(Boolean).join('\n');
}
export {changeRequests} from './agent-change-rules.js';
