import {providerName,policyDisplay} from '../frontend/src/lib/crmDisplay.js';
import {productionVerificationReady} from './production-verification.js';
import {depositDifference} from './workflow-detail-rules.js';
import {validateAllocations,allocationText} from './fund-allocation.js';
export function correctConsolidationAgreement(client,groupId,selection,reason,catalogue,expected){
 const group=client.consolidations?.find(g=>g.id===groupId);
 if(!group||JSON.stringify(group.agreement)!==expected)throw Error('הסיכום השתנה. פתח מחדש את התיקון.');
 if(group.targetMode!=='new'||Object.keys(group.receipts||{}).length||client.decisions.some(d=>group.sourceDecisionIds.includes(d.id)&&(d.produced||d.completed)))throw Error('תיקון זה זמין לפני קליטת מקורות וליעד חדש בלבד.');
 if(!reason?.trim())throw Error('יש לתעד את סיבת התיקון.');
 const result=validateAllocations(selection.allocations,catalogue,selection.targetManager);
 if(!result.valid)throw Error(result.error);
 if(providerName(selection.targetManager)!==providerName(group.agreement.target))throw Error('תיקון מסלולים אינו מחליף את חברת היעד.');
 const after={...group.agreement,targetManager:selection.targetManager,allocations:result.allocations,track:allocationText(result.allocations),fundId:result.allocations.length===1?result.allocations[0].fundId:'',fundPeriod:result.allocations[0].reportPeriod,targetName:selection.targetName||group.agreement.targetName};
 const correction={at:new Date().toISOString(),reason:reason.trim(),before:structuredClone(group.agreement),after:structuredClone(after),previousSummary:client.summary||''};
 return {...client,summarySent:false,consolidations:client.consolidations.map(g=>g.id===groupId?{...g,agreement:after,corrections:[...(g.corrections||[]),correction]}:g),decisions:client.decisions.map(d=>group.sourceDecisionIds.includes(d.id)?{...d,...after,agreementCorrections:[...(d.agreementCorrections||[]),correction]}:d)};
}
// A consolidation is one destination and an immutable set of independently
// verified sources. Planning never moves money or archives a source.
const stamp=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
const present=v=>v!=null&&String(v).trim()!=='';
const amount=v=>present(v)&&Number.isFinite(Number(v))&&Number(v)>=0;
const cents=v=>Math.round(Number(v)*100);
export const consolidationCandidate=p=>!p.archived&&!p.proposed&&['פנסיה','גמל'].includes(p.category)&&!/(חיסכון לכל ילד|חסכון לכל ילד|להשקעה)/.test(p.name||'');
export const consolidationLocked=g=>!!g?.sourceDecisionIds?.length;
export function productFingerprint(client,productId){
 return JSON.stringify({product:client.products.find(p=>p.id===productId),decisions:client.decisions.filter(d=>d.productId===productId),groups:(client.consolidations||[]).filter(g=>g.targetProductId===productId||g.sourceIds.includes(productId))});
}
const noOperation=d=>['להשאיר ללא שינוי','לא מעוניין כרגע','לא הוצע / לא נדון בפגישה'].includes(d.action)||d.stopped;
export function groupForProduct(client,productId){return (client.consolidations||[]).find(g=>g.sourceIds.includes(productId));}
export function consolidationStatus(client,group){
 const sources=group.sourceDecisionIds.map(decisionId=>({decision:client.decisions.find(d=>d.id===decisionId),receipt:group.receipts?.[decisionId]}));
 const received=sources.filter(s=>s.receipt&&s.decision?.produced).length;
 return {received,total:sources.length,completed:sources.length>0&&sources.every(s=>s.receipt&&s.decision?.completed),sources};
}
export function consolidationReadyForUpdate(client,group){
 const status=consolidationStatus(client,group);
 return !status.completed&&status.total>0&&status.sources.every(({decision:d,receipt})=>d&&receipt&&d.produced&&productionVerificationReady(d)&&!d.stopped&&!d.missing&&!d.underwritingPending&&!depositDifference(d).open&&d.fundsConfirmed&&d.transfer?.verified&&d.transfer.document?.data&&Number(receipt.amount)===Number(d.transfer.received));
}
export function finishConsolidation(client,groupId,channel,message){
 const group=client.consolidations?.find(g=>g.id===groupId);
 if(!group||!consolidationReadyForUpdate(client,group))throw Error('יש לאמת ולקלוט את כל מקורות האיחוד ולסגור בירורים לפני עדכון הלקוח.');
 if(!['טלפון','וואטסאפ','מייל'].includes(channel)||!message?.trim())throw Error('יש לתעד כיצד הלקוח עודכן ואת נוסח העדכון.');
 const completion={channel,message:message.trim(),at:stamp(),manual:true};
 return {...client,consolidations:client.consolidations.map(g=>g.id===groupId?{...g,completion}:g),decisions:client.decisions.map(d=>group.sourceDecisionIds.includes(d.id)?{...d,completed:true,completedAt:completion.at,consolidationCompletion:completion}:d)};
}
export function createConsolidation(client,plan){
 const sourceIds=plan.sourceIds||[],targetMode=plan.targetMode;
 if(!['existing','new'].includes(targetMode)||new Set(sourceIds).size!==sourceIds.length||sourceIds.length<(targetMode==='new'?2:1))throw Error('בחר לפחות שני מקורות ליעד חדש, או מקור אחד נוסף לקופה קיימת.');
 if(!plan.eligibilityConfirmed)throw Error('יש לאשר שנבדקה התאמת המקורות והיעד לאיחוד המבוקש.');
 const target=targetMode==='existing'?client.products.find(p=>p.id===plan.targetProductId):null;
 if(targetMode==='existing'&&(!target||!consolidationCandidate(target)||sourceIds.includes(target.id)))throw Error('בחר קופת יעד קיימת ופעילה שאינה מקור לניוד לעצמה.');
 const sources=sourceIds.map(sourceId=>client.products.find(p=>p.id===sourceId));
 if(sources.some(p=>!p||!consolidationCandidate(p)))throw Error('אחד המקורות אינו זמין לאיחוד. רענן ובדוק את הבחירה.');
 const involved=[...sources,...(target?[target]:[])];
 if(!involved.some(p=>p.category==='פנסיה'))throw Error('מהלך זה מיועד לאיחוד פנסיות או פנסיה וגמל תגמולים ופיצויים.');
 for(const p of involved){
  if(plan.fingerprints?.[p.id]!==productFingerprint(client,p.id))throw Error('נתוני אחת הקופות השתנו מאז פתיחת האיחוד. פתח מחדש ובדוק את הנתונים.');
  if(p.category==='גמל'&&!plan.gemelConfirmed?.[p.id])throw Error('יש לוודא במפורש שכל קופת גמל שנבחרה היא תגמולים ופיצויים ומתאימה לאיחוד.');
  if(!amount(p.balance))throw Error('יש להשלים צבירה מדווחת תקינה לכל קופה שנבחרה.');
  if((client.consolidations||[]).some(g=>!consolidationStatus(client,g).completed&&(g.targetProductId===p.id||g.sourceIds.includes(p.id))))throw Error('קופה שנבחרה כבר משויכת לאיחוד פתוח.');
  if(client.decisions.some(d=>d.productId===p.id&&!d.completed&&(!target||p.id!==target.id||!noOperation(d))))throw Error('קיים מהלך או החלטה למקור שנבחר. יש להסיר טיוטה במפורש לפני איחוד; מהלך שכבר נשלח אינו ניתן להחלפה.');
 }
 if(sources.some(p=>!['active','inactive'].includes(plan.sourceModes?.[p.id])))throw Error('יש לבחור פעילה או לא פעילה לכל קופת מקור.');
 const supplied=plan.agreement||{},agreement=Object.fromEntries(['target','targetName','targetManager','track','fundId','fundPeriod','depositFee','balanceFee'].filter(key=>supplied[key]!=null).map(key=>[key,supplied[key]])),category=target?.category||plan.targetCategory;
 if(Array.isArray(supplied.allocations))agreement.allocations=supplied.allocations.map(a=>Object.fromEntries(['fundId','name','percent','manager','reportPeriod'].filter(key=>a[key]!=null).map(key=>[key,a[key]])));
 if(!['פנסיה','גמל'].includes(category)||!present(agreement.target)||!present(agreement.track))throw Error('יש לבחור קופת יעד ומסלולים ולהשלים את התנאים שסוכמו.');
 for(const field of ['depositFee','balanceFee'])if(!amount(agreement[field])||Number(agreement[field])>100)throw Error('יש להזין את שני שיעורי דמי הניהול שסוכמו, כולל אפס במידת הצורך.');
 if(target&&agreement.target!==target.company)throw Error('חברת היעד חייבת להתאים לקופה הקיימת שנבחרה.');
 if(targetMode==='new'&&!agreement.allocations?.length)throw Error('יש לבחור מסלולי יעד מתוך הקטלוג.');
 if(agreement.allocations?.length&&(new Set(agreement.allocations.map(a=>String(a.fundId))).size!==agreement.allocations.length||agreement.allocations.some(a=>!present(a.fundId)||!present(a.name)||!Number.isFinite(Number(a.percent))||Number(a.percent)<=0)||agreement.allocations.reduce((sum,a)=>sum+Math.round(Number(a.percent)*100),0)!==10000))throw Error('חלוקת מסלולי היעד חייבת להיות תקינה ולהסתכם ב־100%.');
 const groupId=id(),targetProductId=target?.id||id(),createdAt=stamp();
 const decisions=sources.map(p=>({id:id(),productId:p.id,productCategory:p.category,targetCategory:category,consolidationId:groupId,targetProductId,processVersion:4,decisionRecorded:true,action:p.category==='פנסיה'?'ניוד קרן פנסיה בהתאם לסיכום':'ניוד קופת גמל בהתאם לסיכום',...agreement,policy:target?.policy||'',sourceBalance:Number(p.balance),sourceAsOf:p.asOf,signatureSent:false,signed:false,sent:false,produced:false,completed:false,transfer:{inactive:plan.sourceModes[p.id]==='inactive',requiresDeposit:plan.sourceModes[p.id]==='active'},createdAt}));
 const group={id:groupId,targetMode,targetProductId,targetCategory:category,targetSnapshot:target?{...target}:null,targetInitialBalance:target?Number(target.balance):0,agreement:{...agreement},sourceIds:[...sourceIds],sourceModes:{...plan.sourceModes},sourceSnapshots:sources.map(p=>({...p})),sourceDecisionIds:decisions.map(d=>d.id),eligibility:{confirmed:true,gemelConfirmed:{...plan.gemelConfirmed},at:createdAt},createdAt,receipts:{}};
 return {...client,consolidations:[...(client.consolidations||[]),group],decisions:[...client.decisions.map(d=>d.signatureSent||d.completed?d:{...d,messagePrepared:false,messageText:'',messageKitIds:undefined}),...decisions],summarySent:false};
}
export function removeConsolidation(client,groupId){
 const group=(client.consolidations||[]).find(g=>g.id===groupId);if(!group)throw Error('האיחוד אינו נמצא בתיק.');
 const sources=client.decisions.filter(d=>d.consolidationId===groupId);
 if(Object.keys(group.receipts||{}).length||sources.some(d=>d.signatureSent||d.signed||d.sent||d.produced||d.completed))throw Error('איחוד שכבר יצא לחתימה או לביצוע אינו ניתן להסרה כטיוטה.');
 return {...client,consolidations:client.consolidations.filter(g=>g.id!==groupId),decisions:client.decisions.filter(d=>d.consolidationId!==groupId),summarySent:false};
}
// Called only after completeDecision has checked the source-specific transfer
// and actual-production gates. A receipt is posted once, keyed by decision ID.
export function receiveConsolidation(client,decision,verifiedValues={}){
 const d=client.decisions.find(x=>x.id===decision.id),group=(client.consolidations||[]).find(g=>g.id===d?.consolidationId);
 if(!d||!group||!group.sourceDecisionIds.includes(d.id)||group.targetProductId!==d.targetProductId)throw Error('הקישור בין המקור לאיחוד אינו תקין.');
 if(group.receipts?.[d.id]||d.produced)throw Error('מקור זה כבר נקלט באיחוד; לא יתווסף סכום נוסף.');
 const source=client.products.find(p=>p.id===d.productId),saved=group.sourceSnapshots.find(p=>p.id===d.productId);
 if(!source||source.archived||!saved||source.id===group.targetProductId||source.category!==saved.category||source.company!==saved.company||source.policy!==saved.policy)throw Error('מקור האיחוד השתנה או כבר נסגר. יש לבדוק אותו לפני קליטה.');
 if(!d.fundsConfirmed||!d.transfer?.verified||!d.transfer.document?.data||!amount(d.transfer.received))throw Error('אין לקלוט מקור ללא סכום שהתקבל בפועל ואסמכתת ניוד מאומתת.');
 if(group.sourceModes[source.id]==='active'&&(d.transfer.inactive||!d.transfer.requiresDeposit||!d.transfer.payrollSent||!d.transfer.depositDate))throw Error('מקור פעיל מחייב בדיקת הפקדה ראשונה לפני קליטת הניוד.');
 let target=client.products.find(p=>p.id===group.targetProductId);
 if(group.targetMode==='existing'&&!target)throw Error('קופת היעד הקיימת לא נמצאה; לא תיווצר קופה חלופית.');
 if(target&&(target.archived||target.category!==group.targetCategory||providerName(target.company)!==providerName(group.targetSnapshot?.company||group.agreement.target)||!amount(target.balance)))throw Error('פרטי קופת היעד השתנו. יש לבדוק לפני הוספת כספי המקור.');
 if(group.targetCategory!=='פנסיה'&&(!present(verifiedValues.policy)||target&&policyDisplay(verifiedValues.policy)!==policyDisplay(target.policy)))throw Error('מספר חשבון היעד שאומת אינו תואם לקופה המשותפת של האיחוד. אין לצרף כספים מחשבונות שונים.');
 if(group.targetMode==='existing'&&target&&policyDisplay(target.policy)!==policyDisplay(group.targetSnapshot.policy))throw Error('זהות חשבון היעד הקיים השתנתה מאז בחירת האיחוד. יש לבדוק לפני קליטה.');
 if(target?.consolidationReceipts?.[d.id])throw Error('סכום המקור כבר נרשם בקופת היעד.');
 const expectedBalance=cents(group.targetInitialBalance)+Object.values(group.receipts||{}).reduce((sum,r)=>sum+cents(r.amount),0);
 if(target&&cents(target.balance)!==expectedBalance)throw Error('יתרת היעד השתנתה מחוץ לאיחוד. יש לבדוק אם היא כבר כוללת את הניוד לפני הוספת כסף — כדי למנוע ספירה כפולה.');
 const receipt={sourceId:source.id,decisionId:d.id,amount:Number(d.transfer.received),effective:d.effective,document:d.transfer.document,at:stamp()};
 const agreement=group.agreement,receivedTotal=cents(target?.balance??0)+cents(receipt.amount);
 if(!Number.isSafeInteger(receivedTotal))throw Error('סכום האיחוד אינו תקין.');
 const targetValues={company:agreement.target,track:agreement.track,allocations:agreement.allocations?.map(a=>({...a})),depositFee:Number(agreement.depositFee),balanceFee:Number(agreement.balanceFee),...verifiedValues,asOf:[target?.asOf,d.effective].filter(Boolean).sort().at(-1)};
 // Existing metadata and previous balance survive; new target is not a spread
 // of the first source (source activity/import keys must not leak into target).
 target={...(target||{id:group.targetProductId,category:group.targetCategory,name:agreement.targetName||group.targetCategory,company:agreement.target,policy:group.targetCategory==='פנסיה'?client.identity:d.policy,coverage:[],demoTarget:true,history:[]}),...targetValues,balance:receivedTotal/100,consolidationReceipts:{...target?.consolidationReceipts,[d.id]:receipt},history:[...(target?.history||[]),{...source,consolidationSource:true,receivedAmount:receipt.amount,receivedAt:receipt.at}]};
 const products=client.products.map(p=>p.id===source.id?{...p,archived:true,consolidationTargetId:target.id,consolidationReceipt:receipt}:p.id===target.id?target:p);
 if(!products.some(p=>p.id===target.id))products.push(target);
 return {...client,products,consolidations:client.consolidations.map(g=>g.id===group.id?{...g,receipts:{...g.receipts,[d.id]:receipt}}:g),decisions:client.decisions.map(x=>x.id===d.id?{...d,produced:true,producedAt:receipt.at,tasks:{...d.tasks,verify:{done:true,at:receipt.at,values:d.pensionVerification?.values||d.productionVerification?.values}},documents:d.documents||[],documentsVerified:!!d.documentsVerified}:x)};
}
