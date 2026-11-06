import {agreedChanges,depositDifference,changeRequests} from './workflow-detail-rules.js';
import {actionKind,isTarget,transferReady,signedKit,pensionTransferReady,israelDate} from './workflow-process.js';
import {allocationText} from './fund-allocation.js';
import {receiveConsolidation} from './workflow-consolidation.js';
import {policyDisplay,providerName,providerOptions} from '../frontend/src/lib/crmDisplay.js';
import {productionVerificationReady,productionProductValues} from './production-verification.js';
import {agentAppointmentReady,changeWorkflowReady} from './agent-change-rules.js';
import {hasFeeChange} from './fee-change-agreement.js';
export const KEY = 'networth-workflow-demo-v1';
export const categories = ['פנסיה','השתלמות','גמל','גמל להשקעה','ביטוח חיים','תאונות אישיות','מחלות קשות','בריאות','סיעוד'];
export const actions = ['להשאיר ללא שינוי','שינוי מסלול','שיפור דמי ניהול','ניוד לגוף אחר','הצטרפות חדשה'];
export const providers = providerOptions('פנסיה',providerOptions('בריאות'));
export const logos = {'הראל':'harel.svg','הפניקס':'phoenix-user.png','מנורה מבטחים':'menora.png','כלל':'clal.svg','מיטב':'meitav.svg','מור':'mor.svg','איילון':'ayalon.png','מגדל':'migdal.png'};
export const initial = () => ({clients:[],selected:null});
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export const event = text => ({id:uid(),at:now(),text});
export const normalizePhone = s => s.replace(/\D/g,'').replace(/^972/,'0');
export const productFor=(c,d)=>c.products.find(p=>p.id===d.productId)||d.proposedProduct;
export const decisionForProduct=(c,productId)=>[...c.decisions].reverse().find(d=>d.productId===productId);
export const currentDecisions=c=>c.decisions.filter(d=>!d.productId||decisionForProduct(c,d.productId)?.id===d.id);
export const noAction=d=>d.stopped||d.action===actions[0]||['לא מעוניין כרגע','לא הוצע / לא נדון בפגישה'].includes(d.action);
export function kitDecisions(c,anchor){const ids=anchor?.messageKitIds;return c.decisions.filter(d=>!noAction(d)&&!d.completed&&(ids?.length?ids.includes(d.id):!d.signed||d.id===anchor?.id));}
export function buildKitMessage(c,anchor){return `היי ${c.name}, שלחתי לך ב־SMS קישור לחתימה על המסמכים שסיכמנו עליהם.\nכשתתפנה, תעבור עליהם ותחתום. אם משהו לא ברור, אני כאן 🙂`;}
export function healthOfferSummary(d){
 const offer=d.healthOffer;if(!offer?.offered||!offer.coverage?.trim())return '';
 return `\nהצעת ביטוח הבריאות שהוצגה: ${offer.coverage}${offer.company?' · חברה: '+offer.company:''}${offer.premium!==''&&offer.premium!=null?' · פרמיה חודשית מוצעת: '+offer.premium+' ₪':''}\nהלקוח בחר שלא להצטרף להצעה בשלב זה.${offer.includeReason&&offer.reason?.trim()?'\nסיבת ההחלטה שנמסרה: '+offer.reason:''}`;
}
export function summaryAction(d){
 return d.action==='ניוד קרן פנסיה בהתאם לסיכום'?`ניוד קרן הפנסיה${d.target?' ל'+d.target:''} בהתאם להמלצה`:`${d.action}${d.target?' · '+d.target:''}`;
}
export function buildSummary(c){
 return `שלום ${c.name},\nסיכום פגישתנו${c.meetingDate?' מ־'+c.meetingDate:''}:\n\n${currentDecisions(c).map(d=>{
  if(actionKind(d.action)==='change'&&!hasFeeChange(d))d={...d,depositFee:'',balanceFee:'',targetPremium:''};
  const p=productFor(c,d),group=c.consolidations?.find(g=>g.id===d.consolidationId);if(d.action==='לא הוצע / לא נדון בפגישה')return `${p?.category||'מוצר'}: לא הוצע / לא נדון בפגישה.${d.reason?'\n'+d.reason:''}`;return `${p?.category||'מוצר'}${p?.policy?' · '+policyDisplay(p.policy):''}\n${p?.proposed?'לא מופיע מוצר מדווח בתיק':'מצב קיים: '+[providerName(p?.company),p?.track,p?.depositFee!=null?'דמי ניהול מהפקדה '+p.depositFee+'%':'',p?.balanceFee!=null?'דמי ניהול מצבירה '+p.balanceFee+'%':''].filter(Boolean).join(' · ')}\nסוכם: ${summaryAction(d)}${group?'\nמקור באיחוד ל'+(group.targetMode==='existing'?'קופה קיימת בתיק':'קופה חדשה')+' אחת: '+group.agreement.target+' · '+group.targetCategory+'. מעקב הקליטה נפרד לכל מקור.':''}${d.allocations?.length?'\nחלוקת מסלולי היעד: '+allocationText(d.allocations):d.track?' · '+d.track:''}${d.riders?.length?'\nנספחים שסוכמו: '+d.riders.join(' · '):''}${d.riderDetail?' · '+d.riderDetail:''}${d.targetCoverage?'\nסכום ביטוח מוצע: '+d.targetCoverage+' ₪':''}${!d.allocations?.length&&d.fundId?' (מסלול '+d.fundId+')':''}${d.depositFee!==undefined&&d.depositFee!==''?' · דמי ניהול מהפקדה '+d.depositFee+'%':''}${d.balanceFee!==undefined&&d.balanceFee!==''?' · דמי ניהול מצבירה '+d.balanceFee+'%':''}${d.targetPremium!==undefined&&d.targetPremium!==''?'\nפרמיה חודשית מוצעת: '+d.targetPremium+' ₪':''}${d.agreedBeneficiaries?'\nמוטבים שסוכמו: '+d.agreedBeneficiaries:''}${d.agreedCoverage?'\nכיסוי שסוכם: '+d.agreedCoverage:''}${d.agreedExclusions?'\nתנאים והחרגות שסוכמו: '+d.agreedExclusions:''}${d.agreedEffective?'\nתאריך תחילה שסוכם: '+d.agreedEffective:''}${actionKind(d.action)==='change'?'\nהשינויים שסוכמו:\n'+(agreedChanges(d)||'טרם פורטו — יש להשלים לפני שליחה'):''}${healthOfferSummary(d)}${d.reason?'\n'+d.reason:''}`;
 }).join('\n\n')}${c.meetingNotes?'\n\nהערות נוספות:\n'+c.meetingNotes:''}\n\nדוד · NETWORTH\n[הדגמה בלבד]`;
}
export function makeClient(data) { return {...data,id:uid(),created:now(),stage:'ליד קר',call:'',consent:'טרם תועד',document:'טרם נשלח',info:'טרם הוזמן',products:[],decisions:[],messages:[],events:[event('ליד נוצר בדמו')],appointments:[],reports:[],meetingDone:false,summary:'',summarySent:false}; }
export function fixtures(date) {
 return [
  {id:uid(),category:'פנסיה',company:'הראל',name:'פנסיה מקיפה',policy:'DEMO-101',balance:148500,deposit:2100,depositFee:1.5,balanceFee:0.18,track:'תלוי גיל — עד 50',coverage:[{name:'קצבת נכות חודשית',amount:7500},{name:'קצבת שאירים חודשית',amount:6000}],asOf:date},
  {id:uid(),category:'השתלמות',company:'כלל',name:'קרן השתלמות',policy:'DEMO-202',balance:82000,deposit:1571,balanceFee:0.65,track:'כללי',coverage:[],asOf:date},
  {id:uid(),category:'גמל',company:'מיטב',name:'קופת גמל',policy:'DEMO-303',balance:24000,balanceFee:0.6,track:'כללי',warning:'עיקול דווח בתמונת המצב לדוגמה — נדרשת בדיקה',coverage:[],asOf:date},
  {id:uid(),category:'גמל להשקעה',company:'מור',name:'גמל להשקעה',policy:'DEMO-404',balance:18000,deposit:500,balanceFee:0.7,track:'כללי',coverage:[],asOf:date},
  {id:uid(),category:'ביטוח חיים',company:'כלל',name:'ביטוח חיים',policy:'DEMO-505',premium:75,coverage:[{name:'פיצוי למקרה מוות',amount:1000000}],asOf:date},
  {id:uid(),category:'תאונות אישיות',company:'הראל',name:'תאונות אישיות',policy:'DEMO-606',premium:35,coverage:[{name:'נכות מתאונה'},{name:'שברים וכוויות'}],asOf:date},
  {id:uid(),category:'מחלות קשות',company:'הפניקס',name:'מחלות קשות',policy:'DEMO-707',premium:80,coverage:[{name:'פיצוי מחלות קשות',amount:200000}],asOf:date},
  {id:uid(),category:'בריאות',company:'הראל',name:'ביטוח בריאות',policy:'DEMO-808',premium:145,coverage:[{name:'ניתוחים בישראל'},{name:'תרופות מחוץ לסל'},{name:'השתלות וטיפולים בחו״ל'}],asOf:date},
  {id:uid(),category:'סיעוד',company:'מנורה מבטחים',name:'ביטוח סיעודי',policy:'DEMO-909',premium:40,coverage:[{name:'כיסוי סיעודי — תנאי דוגמה'}],asOf:date},
 ];
}
export function decisionStatus(d) {
 if(d.stopped)return 'ההצטרפות הופסקה — הישן ללא שינוי';
 if(d.underwritingPending)return d.underwriting?.alternative?'בדיקת חלופה — ממתין להחלטה':'תנאי חיתום בטיפול';
 if(noAction(d)) return 'ללא פעולה';
 if(d.completed) return 'הושלם';
 if(d.produced) return 'הופק — משימות המשך פתוחות';
 if(d.missing) return 'נדרשת השלמה';
 if(d.companyReport?.kind==='completed')return 'החברה דיווחה על השלמה — ממתין לאימות';
 if(d.companyReport?.kind==='missing')return 'התקבלה בקשת השלמה מהחברה — לבדיקה';
 if(d.companyReport?.kind==='received')return 'החברה אישרה קבלת בקשה — בטיפול';
 if(d.approved) return 'אישור חברה התקבל — ממתין לקליטת הביצוע';
 if(d.sent) return 'ממתין לחברה';
 if(d.signed) return 'חתום · יש לוודא שליחה';
 if(d.signatureSent) return d.messagePrepared?'ממתין לחתימה':'הכנת הודעת וואטסאפ לאחר השליחה';
 return 'הכנת הקיט ושליחה לחתימה';
}
export function readyToClose(d) {
 if(pensionTransferReady(d))return !d.produced;
 return agentAppointmentReady(d)&&changeWorkflowReady(d)&&(!isTarget(d.action)||productionVerificationReady(d)) && !depositDifference(d).open && !d.stopped && !d.underwritingPending && !d.produced && d.signatureSent && d.signed && signedKit(d) && d.sent && d.approved && !d.missing && d.evidence?.trim() && d.effective &&
  (!isTarget(d.action) || (d.targetCategory||d.productCategory)==='פנסיה' || d.productionVerification?.values?.policy?.trim() || d.policy?.trim()) &&
  (actionKind(d.action)!=='transfer' || transferReady(d));
}
export function finishPensionTransfer(client,id,channel,message){
 let d=client.decisions.find(x=>x.id===id);
 if(!d||d.completed||!pensionTransferReady(d))throw Error('יש להשלים אימות ניוד ולסגור את כל הבירורים לפני עדכון וסגירה.');
 if(d.consolidationId){if(d.produced)throw Error('המקור כבר נקלט. עדכון הלקוח יתועד פעם אחת באיחוד כולו.');return completeDecision(client,d);}
 if(!['טלפון','וואטסאפ','מייל'].includes(channel)||!message?.trim())throw Error('יש לתעד כיצד הלקוח עודכן ואת נוסח העדכון.');
 d={...d,effective:d.pensionVerification.values.date,receivedAmount:String(d.transfer.received)};
 let next={...client,decisions:client.decisions.map(x=>x.id===id?d:x)};
 if(!d.produced)next=completeDecision(next,d);
 return {...next,decisions:next.decisions.map(x=>x.id===id?{...x,completed:true,completedAt:now(),pensionCompletion:{channel,message,at:now(),manual:true}}:x)};
}
export function completeDecision(c,d) {
 d=c.decisions.find(x=>x.id===d.id);
 if(!d)throw Error('המהלך אינו נמצא בתיק');
 if(!readyToClose(d)) throw new Error('יש להשלים אישור חברה, אסמכתה ופרטי ביצוע לפני סגירה');
 const actual=productionProductValues(d);
 d={...d,...(actual.asOf?{effective:actual.asOf}:{}),...(actual.policy?{policy:actual.policy}:{})};
 if(d.consolidationId)return receiveConsolidation({...c,decisions:c.decisions.map(x=>x.id===d.id?d:x)},d,actual);
 const source=productFor(c,d);
 if(!source)throw Error('מוצר המקור לא נמצא');
 const snapshot={...source};
 let products=c.products;
 const changes={company:d.target||source.company,track:d.allocations?.length?allocationText(d.allocations):d.track||source.track,...(d.allocations?.length?{allocations:d.allocations.map(r=>({...r}))}:{}),depositFee:d.depositFee==null||d.depositFee===''?source.depositFee:Number(d.depositFee),balanceFee:d.balanceFee==null||d.balanceFee===''?source.balanceFee:Number(d.balanceFee),asOf:d.effective,...actual,...(d.changeTasks?.fees?.actual?.premium!=null?{premium:Number(d.changeTasks.fees.actual.premium)}:{})};
 if(actionKind(d.action)==='change'&&!hasFeeChange(d))Object.assign(changes,{depositFee:source.depositFee,balanceFee:source.balanceFee,premium:source.premium});
 if(isTarget(d.action)) {
  products=products.map(p=>p.id===source.id && actionKind(d.action)==='transfer'?{...p,archived:true}:p.id===source.id&&actionKind(d.action)==='replace'?{...p,pendingCancellation:true}:p);
  // Completion records actual received balance; source balance is never assumed to have transferred.
  products=[...products,{...source,...changes,id:uid(),importKey:undefined,pendingCancellation:false,name:d.targetName||source.category,proposed:false,policy:source.category==='פנסיה'?c.identity:d.policy,warning:undefined,balance:source.balance===undefined?undefined:(d.receivedAmount===''?undefined:Number(d.receivedAmount)),premium:d.targetPremium!==undefined&&d.targetPremium!==''?Number(d.targetPremium):undefined,history:source.proposed?[]:[snapshot],coverage:source.category==='בריאות'?[...(d.riders||[]),...(d.riderDetail?[d.riderDetail]:[])].map(name=>({name})):['ביטוח חיים','מחלות קשות'].includes(source.category)?(d.targetCoverage? [{name:'סכום ביטוח',amount:Number(d.targetCoverage)}]:[]):[],demoTarget:true,...actual}];
 } else products=products.map(p=>p.id===source.id?{...p,...changes,history:[...(p.history||[]),snapshot]}:p);
 return {...c,products,decisions:c.decisions.map(x=>x.id===d.id?{...d,produced:true,producedAt:now(),tasks:{...d.tasks,verify:{done:true,at:now(),values:d.productionVerification?.values||d.pensionVerification?.values||{},source:d.productionVerification?.source||'company_site'}},documents:d.documents||[],documentsVerified:!!d.documentsVerified}:x)};
}
