import PayrollMailFiles from './payroll-mail-files.jsx';
import PayrollReply from './payroll-reply.jsx';
import {payrollReplyPending} from './payroll-reply.js';
import {payrollText} from './payroll-text.js';
import TypedDate from './typed-date.jsx';
import {policyDisplay} from '../frontend/src/lib/crmDisplay.js';
import {depositDifference} from './workflow-detail-rules.js';
import {depositDefaults} from './pension-verification.js';
import {validPastDate} from './production-verification.js';
import React,{useState,useEffect} from 'react';
import {businessDate,israelDate,transferReady} from './workflow-process.js';
import {transferStage,transferNext,payrollCheckDate} from './workflow-transfer-stages.js';
import Evidence from './workflow-evidence.jsx';
import {transferDraftWithEvidence} from './inbound-transfer.js';
export default function TransferChecks({d,p,change,sendPayroll,inboundMail,clientId,clientName,clientIdentity}){
 const [draft,setDraft]=useState(()=>depositDefaults(transferDraftWithEvidence(d,p,inboundMail))),[error,setError]=useState(''),[sending,setSending]=useState(false),[retryPayroll,setRetryPayroll]=useState(false);
 useEffect(()=>{setDraft(depositDefaults(transferDraftWithEvidence(d,p,inboundMail)));},[d.transfer,d.companyReport,inboundMail,p.policy]);
 const discrepancy=depositDifference(d);
 const f=d.transfer||{},invalidDeposit=f.inactive===false&&f.payrollSent&&f.depositDate&&!validPastDate(f.depositDate),stage=retryPayroll?'payroll':invalidDeposit?'deposit':transferStage(d),next=retryPayroll?{title:'שליחת המסמכים לחשבת השכר במייל בדיקה'}:invalidDeposit?{title:'תיקון תאריך קבלת ההפקדה'}:transferNext(d),today=israelDate();
 useEffect(()=>{if(d.transfer?.payrollDelivery)setRetryPayroll(false);},[d.transfer?.payrollDelivery]);
 const base=d.sourceBalance??p.balance;
 const expected=Number(draft.salary)*(Number(draft.employee||0)+Number(draft.employer||0)+Number(draft.severance||0))/100;
 const received=draft.received!==undefined&&draft.received!==''?Number(draft.received):null;
 const gap=received===null||base==null?null:received-base,tolerance=f.inactive?50:expected;
 const exceptional=gap!==null&&Math.abs(gap)>tolerance;
 const edit=(key,value)=>setDraft(x=>({...x,[key]:value}));
 const save=(patch,text,extra={})=>change({transfer:{...draft,...patch,verified:false},fundsConfirmed:false,...extra},text);
 const input=(key,label,type='number')=><label className="wf-field" key={key}>{label}<TypedDate type={type} min={type==='number'?0:undefined} max={type==='number'&&['employee','employer','severance'].includes(key)?100:type==='date'?today:undefined} step={type==='number'?'0.01':undefined} required value={draft[key]??''} onInput={e=>edit(key,e.target.value)}/></label>;
 return <section className="wf-kit" aria-label="מעקב הפקדה וניוד"><h3>הפקדה וניוד · {p.company} · {policyDisplay(p.policy)}</h3>
 <p>קרן פעילה: חשבת שכר ← הפקדה ראשונה ← ניוד. קרן לא פעילה: מעקב ניוד ללא המתנה להפקדה.</p>
 {sendPayroll&&f.payrollSent&&!f.payrollDelivery&&!d.fundsConfirmed&&!retryPayroll&&<p className="wf-warning">השליחה הקודמת תועדה בדמו בלבד. <button type="button" onClick={()=>setRetryPayroll(true)}>שליחת המסמכים בפועל למייל הבדיקה</button></p>}
 {stage!=='mode'&&<p className="wf-muted">{f.inactive?'קרן מקור לא פעילה':'קרן מקור פעילה'} · צבירה במקור: {base==null?'לא דווחה':Number(base).toLocaleString('he-IL')+' ₪'} · נכון ל־{d.sourceAsOf||p.asOf}</p>}
 {discrepancy.open&&<form className="wf-warning" onSubmit={e=>{e.preventDefault();const resolution=String(new FormData(e.currentTarget).get('resolution')||'').trim();if(!resolution)return;change({transfer:{...f,depositResolution:resolution,depositResolvedAt:today}},'בירור פער ההפקדה הושלם');}}><h3>משימה פתוחה: בירור פער בהפקדה</h3><p>צפוי {discrepancy.expected} ₪ · התקבל {discrepancy.actual} ₪ · פער {discrepancy.gap} ₪</p><p>יש לברר מול חשבת השכר / החברה. המעבר למעקב הניוד חסום עד לתיעוד הסבר לפער.</p><label className="wf-field">תוצאת הבירור ואסמכתה<TypedDate name="resolution" required/></label><button>תיעוד פתרון וסגירת הבירור</button></form>}
 {!retryPayroll&&payrollReplyPending(d)&&<PayrollReply d={d} change={change}/>}
 {f.payrollReply?.status==='confirmed'&&<p className="wf-success">✓ חשבת השכר אישרה עדכון מחודש {f.payrollReply.salaryMonth}. עדיין נדרש אימות הפקדה בפועל בקופה.</p>}
 {stage!=='done'&&<details className="wf-step-next" open={stage!=='deposit'||!payrollReplyPending(d)||!next.due||next.due<=today}><summary>{next.title}{next.due?' · '+next.due:''}</summary>
 {stage==='mode'&&<div className="wf-actions"><button className="secondary" onClick={()=>save({inactive:false,requiresDeposit:true},'נבחר מעקב קרן פעילה — ממתינים להפקדה ראשונה')}>קרן פעילה</button><button className="secondary" onClick={()=>save({inactive:true,requiresDeposit:false},'נבחר מעקב קרן לא פעילה — ללא תנאי הפקדה')}>קרן לא פעילה</button></div>}
 {stage==='payroll'&&d.consolidationId&&<button type="button" className="secondary" onClick={()=>{if(window.confirm('האם כל מקורות האיחוד שייכים לאותו מעסיק ולאותו יעד הפקדה? פרטי חשבת השכר והמסמכים ישותפו, ללא תיעוד שליחה או הפקדה.')){const ok=change({sharePayrollDraft:draft},'שותפו פרטי חשבת השכר והמסמכים באיחוד לאחר אישור מעסיק משותף — ללא שליחה');setError(ok===false?'השיתוף לא בוצע. בדוק את הודעת השגיאה בתיק.':'הפרטים שותפו למקורות האיחוד. לא נשלח מייל.');}}}>שיתוף פרטי חשבת השכר והמסמכים לכל האיחוד</button>}
 {stage==='payroll'&&<form onSubmit={async e=>{e.preventDefault();if(sending)return;setSending(true);setError('');try{const receipt=sendPayroll?await sendPayroll(draft):null;const saved=save({payrollSent:true,requiresDeposit:true,payrollSentAt:receipt?.payrollSentAt||draft.payrollSentAt,payrollDelivery:receipt},receipt?'המסמכים לחשבת השכר נשלחו למייל הבדיקה — נפתחה בדיקת הפקדה':'תועדה שליחה לחשבת שכר בדמו — נפתחה בדיקת הפקדה',{...((d.targetCategory||p.category)!=='פנסיה'?{policy:draft.policy}:{})});if(saved===false)throw Error('התיעוד לא נשמר. אם המייל נשלח, ניסיון חוזר לא ישלח עותק נוסף.');}catch(e){setError(e.response?.data?.error||e.message||'השליחה נכשלה');}finally{setSending(false);}}}><fieldset disabled={sending} style={{border:0,padding:0,margin:0}}>
 <p>מצרפים נספח ו׳ וטופס קוביות מ־SMS 2010. {sendPayroll?'נמען מיועד: '+(draft.payrollEmail||'טרם הוזן')+' · בפועל בסטייגינג: davidsdreams55@gmail.com — ללא עותק לחשבת.':'כאן מתעדים שליחה בדמו בלבד.'}</p>
 <div className="wf-fields">{input('payrollEmail','כתובת חשבת שכר','email')}{(d.targetCategory||p.category)!=='פנסיה'&&input('policy','מספר חשבון / פוליסה בקרן החדשה','text')}{!sendPayroll&&input('payrollSentAt','תאריך השליחה לחשבת השכר','date')}{input('salaryMonth','חודש השכר הצפוי','month')}</div>
 <PayrollMailFiles clientId={clientId} onSelect={edit}/><Evidence label="נספח ו׳" file={draft.annex} onChange={file=>edit('annex',file)}/><Evidence label="טופס קוביות" file={draft.cubes} onChange={file=>edit('cubes',file)}/>
 <p>בדיקת ההפקדה: יום 20 בחודש העוקב לשליחה{draft.payrollSentAt?' · '+payrollCheckDate(draft.payrollSentAt):''}.</p>
 <details open><summary>תצוגת המייל לפני שליחה</summary><p>נמען מיועד: {draft.payrollEmail||"טרם הוזן"}</p><p style={{whiteSpace:"pre-line"}}>{payrollText({name:clientName||"הלקוח",identity:clientIdentity},draft)}</p></details><button type="button" className="secondary" onClick={()=>change({transfer:{...f,...draft}},'נשמרו מסמכי חשבת השכר כטיוטה — ללא שליחה')}>שמירת מסמכים וטיוטה</button> <button disabled={sending||!(draft.annex?.data||draft.annex?.storage==='staging-private'&&draft.annex?.id)||!(draft.cubes?.data||draft.cubes?.storage==='staging-private'&&draft.cubes?.id)}>{sending?'שולח…':sendPayroll?'שליחת המסמכים למייל הבדיקה והמשך להפקדה':'דימוי שליחה לחשבת שכר והמשך להפקדה'}</button></fieldset></form>}
 {stage==='deposit'&&<form onSubmit={e=>{e.preventDefault();if(!validPastDate(draft.depositDate)||!(Number(draft.depositActual)>0)){setError('יש להזין תאריך תקין וסכום הפקדה גדול מאפס. אם לא התקבלה הפקדה, בחר טרם הופקד.');return;}if(!(expected>0)){setError('יש להשלים שכר ושיעורי הפקדה לחישוב הצפי');return;}save({requiresDeposit:true,depositRetry:null,depositResolution:'',depositResolvedAt:''},Math.abs(Number(draft.depositActual)-expected)>100?'תועדה הפקדה — נפתחה משימת בירור פער '+Math.abs(Number(draft.depositActual)-expected).toFixed(2)+' ₪; ההתקדמות חסומה עד לתיעוד הסבר':'אומתה הפקדה ראשונה באתר החברה — נפתח מעקב ניוד');setError('');}}>
 <p>בדוק באתר החברה. אישור חשבת שכר אינו אישור שהכסף התקבל.</p>
 <div className="wf-fields">{[['salary','שכר מבוטח'],['employee','אחוז עובד'],['employer','אחוז מעסיק'],['severance','אחוז פיצויים']].map(([key,label])=>input(key,label))}{input('depositActual','סכום שהופקד בפועל')}{input('depositDate','תאריך קבלת ההפקדה','date')}</div>
 <p>הפקדה צפויה: {Number.isFinite(expected)?expected.toFixed(2):'—'} ₪</p>
 {draft.depositActual!==undefined&&draft.depositActual!==''&&Math.abs(Number(draft.depositActual)-expected)>100&&<p className="wf-warning">פער מעל 100 ₪ — שמור את תוצאת הבדיקה ותעד הסבר לפער לפני המשך למעקב ניוד.</p>}
 <button>{depositDifference({...d,transfer:{...draft,depositResolution:''}}).open?'שמירת הפקדה ופתיחת בירור פער':'ההפקדה נבדקה — המשך למעקב ניוד'}</button> <button type="button" className="secondary" onClick={()=>save({depositRetry:businessDate(today,3),depositDate:'',depositActual:''},'טרם התקבלה הפקדה — מעקב נוסף בעוד 3 ימי עסקים')}>טרם הופקד</button></form>}
 {stage==='transfer'&&<form onSubmit={e=>{e.preventDefault();const candidate={...d,sourceBalance:base,policy:d.policy||draft.policy,fundsConfirmed:true,transfer:{...draft,requiresDeposit:!f.inactive,verified:true}};if(!transferReady(candidate)){setError('יש להשלים סכום, מסמך ובירור פער אם נדרש, ובקרן פעילה את פרטי ההפקדה והחשבון.');return;}change({sourceBalance:base,policy:candidate.policy,fundsConfirmed:true,receivedAmount:String(received),transfer:candidate.transfer},'אומתו סכום ומסמך הניוד בדמו');setError('');}}>
 <p>בדוק באתר החברה החדשה שכספי הקרן הישנה התקבלו. ההפקדה הראשונה אינה אישור ניוד.</p>
 {input('received','סכום כספי הניוד שהתקבלו')}
 {draft.inboundMailId&&<p className="wf-muted">הסכום והאישור מולאו מהמייל המשויך למקור זה. חשבון יעד מדווח: {draft.reportedTargetPolicy}. הנתונים ממתינים לאימות שלך.</p>}
 {input('receivedDate','תאריך קבלת כספי הניוד','date')}
 {(d.targetCategory||p.category)!=='פנסיה'&&!d.policy&&input('policy','מספר חשבון / פוליסה ביעד','text')}
 <Evidence label="מסמך ניוד" file={draft.document} onChange={file=>edit('document',file)}/>
 {gap!==null&&<p>פער מול המקור: {gap.toFixed(2)} ₪ · סף בדיקה: {Number.isFinite(tolerance)?tolerance.toFixed(2):'חסר'} ₪</p>}
 {exceptional&&<>{input('resolution','תוצאת בירור הפער ואישור הסכום','text')}<p className="wf-warning">הסגירה ממתינה לתיעוד פתרון הפער.</p></>}
 <button>אימות כספי הניוד</button> <button type="button" className="secondary" onClick={()=>save({deskDue:businessDate(today,2)},'הניוד לא הושלם — מעקב נוסף מול הדסק')}>לא התקבל / התקבל חלקית</button></form>}
 {error&&<p className="wf-error" role="alert">{error}</p>}</details>}
 {stage==='done'&&<p className="wf-success">✓ כספי הניוד אומתו. ממשיכים לקליטת המוצר לפי אישור החברה, מסירת המסמכים ועדכון הלקוח.</p>}
 {(f.payrollSent||f.depositDate||d.fundsConfirmed)&&<details><summary>שלבים שהושלמו</summary>{f.payrollSent&&<p>✓ מסמכים לחשבת שכר · {f.payrollSentAt||'תאריך לא תועד בגרסה הקודמת'}</p>}{f.depositDate&&!discrepancy.open&&<p>✓ הפקדה ראשונה: {f.depositActual} ₪ · {f.depositDate}</p>}{d.fundsConfirmed&&<p>✓ ניוד: {f.received} ₪ · {f.document?.name}</p>}</details>}
 <small>חישובי ימי עסקים בדמו אינם כוללים חגים.</small></section>;
}
