import TypedDate from './typed-date.jsx';
import {hasFeeChange} from './fee-change-agreement.js';
import {meetingDateFor} from './meeting-context.js';
import StagingSummaryMail from '../frontend/src/pages/StagingSummaryMail.jsx';
import {actionOptions,actionKind,isTarget,healthRiders} from './workflow-process.js';
import {recommendationFor} from './workflow-recommendations.jsx';
import React,{useEffect,useState,useRef} from 'react';
import {initialAllocations,validateAllocations,allocationText} from './fund-allocation.js';
import {actions,providers,uid,productFor,buildSummary,decisionForProduct,currentDecisions} from './workflow-model.js';
import './fund-picker.css';
import {policyDisplay,providerName,providerOptions} from '../frontend/src/lib/crmDisplay.js';
import {ConsolidationOverview} from './workflow-consolidation.jsx';
import {consolidationStatus} from './workflow-consolidation.js';
import {orderedProducts,productOrder} from './workflow-products.jsx';

const fee=v=>v==null?'לא דווח':v+'%';
const shortCompany=name=>providerName(name);
const catalogueCache=new Map();
async function fetchFundOptions(type,signal){
 // The same-origin staging gateway requires its access cookie. The server
 // reads public data separately and never forwards this cookie upstream.
 const response=await fetch('/preview-catalogue?type='+encodeURIComponent(type),{signal,credentials:'same-origin'});
 const data=await response.json();
 if(!response.ok||!Array.isArray(data.rows))throw Error(data.error||'קטלוג המסלולים אינו זמין כרגע');
 return data.rows;
}
const Input=({label,...props})=><label className="wf-field"><span>{label}</span><TypedDate {...props}/></label>;
export function FundPicker({product,action,onChange,initial,onCatalogue}) {
 const [rows,setRows]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0);
 const [manager,setManager]=useState(initial?.targetManager||''),[parts,setParts]=useState(()=>initialAllocations(initial)),[fundClass,setFundClass]=useState('');
 const type=product.category==='פנסיה'?'pension':'gemel';
 useEffect(()=>{onCatalogue?.(rows);},[rows,onCatalogue]);
 useEffect(()=>{let disposed=false;const cached=catalogueCache.get(type);if(cached){setRows(cached);setError('');setLoading(false);const old=cached.find(r=>r.id===(initial?.allocations?.[0]?.fundId||initial?.fundId));if(old)setManager(old.manager);return;}
  const ctrl=new AbortController();setLoading(true);setError('');setRows([]);
  const timeout=setTimeout(()=>ctrl.abort(),15000);
  fetchFundOptions(type,ctrl.signal).then(data=>{if(disposed)return;catalogueCache.set(type,data);setError('');setRows(data);const old=data.find(r=>r.id===(initial?.allocations?.[0]?.fundId||initial?.fundId));if(old)setManager(old.manager);}).catch(e=>{if(disposed)return;if(!ctrl.signal.aborted)setError('לא ניתן לטעון את קטלוג המסלולים הציבורי כרגע. נסה שוב.');else setError('הטעינה ארכה מדי. ניתן לנסות שוב.');}).finally(()=>{clearTimeout(timeout);if(!disposed)setLoading(false);});
  return ()=>{disposed=true;clearTimeout(timeout);ctrl.abort();};
 },[type,attempt]);
 const sameCompany=action==='שינוי מסלול'||actionKind(action)==='change';
 const eligible=rows.filter(r=>!sameCompany||shortCompany(r.manager)===shortCompany(product.company));
 const managers=[...new Set(eligible.map(r=>r.manager))].sort((a,b)=>a.localeCompare(b,'he'));
 const inferredClass=rows.find(r=>String(r.id)===String(parts.find(p=>p.fundId)?.fundId))?.classification;
 const selectedFundClass=fundClass||inferredClass||'';
 const available=eligible.filter(r=>r.manager===manager&&(type!=='pension'||r.classification===selectedFundClass));
 const checked=validateAllocations(parts,eligible,manager);
 useEffect(()=>{
  const result=validateAllocations(parts,eligible,manager);
  onChange(result.valid?{target:shortCompany(manager),targetManager:manager,allocations:result.allocations,track:allocationText(result.allocations),fundId:result.allocations.length===1?result.allocations[0].fundId:'',fundPeriod:result.allocations[0].reportPeriod}:null);
 },[rows,manager,parts,action,product.company]);
 const changePart=(index,values)=>setParts(old=>old.map((r,i)=>i===index?{...r,...values}:r));
 const selectedClass=available.find(r=>String(r.id)===String(parts.find(p=>p.fundId)?.fundId))?.classification;

 return <div className="wf-fund-picker"><div className="wf-section-head"><b>בחירת יעד מתוך {type==='pension'?'פנסיה־נט':'גמל־נט'}</b><small>נתונים ציבוריים · ללא פרטי לקוח</small></div>
 {loading?<p role="status">טוען גופים ומסלולים מהמאגר…</p>:error?<div role="alert" className="wf-warning">{error} <button type="button" className="secondary" onClick={()=>setAttempt(a=>a+1)}>ניסיון חוזר</button></div>:<>
 <label className="wf-field"><span>גוף מנהל יעד</span><select required value={manager} onChange={e=>{setManager(e.target.value);setFundClass('');setParts([{fundId:'',percent:'100'}]);onChange(null);}}><option value="">בחר גוף מנהל</option>{managers.map(m=><option key={m}>{m}</option>)}</select></label>
 {type==='pension'&&<label className="wf-field"><span>סוג קרן הפנסיה</span><select required disabled={!manager} value={selectedFundClass} onChange={e=>{setFundClass(e.target.value);setParts([{fundId:'',percent:'100'}]);onChange(null);}}><option value="">בחר מקיפה או משלימה / כללית</option>{[...new Set(eligible.filter(r=>r.manager===manager).map(r=>r.classification).filter(Boolean))].map(v=><option key={v} value={v}>{['כללית','קרנות כלליות'].includes(v)?'משלימה / כללית':v==='קרנות חדשות'?'מקיפה':v}</option>)}</select></label>}
 {parts.map((part,index)=><div className="wf-fields wf-allocation-row" key={index}>
  <label className="wf-field"><span>קרן ומסלול יעד {index+1}</span><select required disabled={!manager} value={part.fundId} onChange={e=>changePart(index,{fundId:e.target.value})}><option value="">בחר מסלול</option>{available.filter(r=>(!selectedClass||r.classification===selectedClass||String(r.id)===part.fundId)&&!parts.some((p,i)=>i!==index&&p.fundId===String(r.id))).map(r=><option key={r.id} value={r.id}>{r.name} · {r.id}</option>)}</select></label>
  <label className="wf-field wf-allocation-percent"><span>אחוז במסלול {index+1}</span><TypedDate type="number" min="0.01" max="100" step="0.01" required value={part.percent} onChange={e=>changePart(index,{percent:e.target.value})}/></label>
  {parts.length>1&&<button type="button" className="wf-link wf-allocation-remove" onClick={()=>setParts(old=>old.filter((_,i)=>i!==index))}>הסר מסלול {index+1}</button>}
 </div>)}
 <div className="wf-actions"><button type="button" className="secondary" disabled={!manager} onClick={()=>setParts(old=>[...old,{fundId:'',percent:''}])}>+ הוסף מסלול</button><strong role="status">סה״כ חלוקה: {checked.total}% מתוך 100%</strong></div>
 {manager&&!checked.valid&&<p className="wf-warning" role="status">{checked.error}</p>}
 <p className="wf-muted">החלוקה נשמרת כהחלטה שסוכמה; אינה אישור לביצוע בחברה. שינוי סוג הקרן מנקה את בחירות המסלולים הקודמות.</p>
 </>}

 {rows.length>0&&<small>תקופת דיווח {rows[0].reportPeriod.slice(4)}/{rows[0].reportPeriod.slice(0,4)}. דמי הניהול שסוכמו מוזנים בנפרד — לא ממוצע מהמאגר.</small>}
 </div>;
}

function ProductDiscussion({p,decision,onSave,onRemove,open,consolidationTarget=false,recommendation={entries:{},text:''}}) {
 const existing=decision;
 const [action,setAction]=useState(existing?.action||''),[target,setTarget]=useState(null),[error,setError]=useState('');
 const savings=['פנסיה','השתלמות','גמל','גמל להשקעה'].includes(p.category);
 const baseChoices=p.proposed?[actionOptions[6],'לא מעוניין כרגע']:actionOptions.filter((a,i)=>![3,4,5].includes(i)||i===(p.category==='פנסיה'?3:p.category==='השתלמות'?4:savings?5:-1)).filter(a=>!savings||actionKind(a)!=='replace');
 const choices=p.category==='בריאות'?[...baseChoices,'לא הוצע / לא נדון בפגישה']:baseChoices;
 const [riders,setRiders]=useState(existing?.riders||[]);
 const kind=actionKind(action);
 const [changeTrack,setChangeTrack]=useState(!!existing?.allocations?.length||!!existing?.track);
 const [changeFees,setChangeFees]=useState(hasFeeChange(existing||{}));
 const needsFund=savings&&(['transfer','new'].includes(kind)||kind==='change'&&changeTrack);
 const locked=existing?.signatureSent||existing?.completed||existing?.produced||!!existing?.consolidationId||consolidationTarget;
 const healthRefused=p.category==='בריאות'&&action==='לא מעוניין כרגע';
 function submit(e){
  e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget));
  if(needsFund&&!target){setError('יש לבחור גוף וקרן / מסלול מהרשימה');return;}
  if(p.category==='בריאות'&&isTarget(action)&&!riders.length&&!v.riderDetail?.trim()){setError('יש לבחור לפחות נספח אחד שסוכם');return;}
  const hasFees=[v.depositFee,v.balanceFee,v.targetPremium].some(value=>value!=null&&value!=='');
  if(kind==='change'&&changeFees&&!hasFees){setError('יש להזין את התנאים שסוכמו לבקשת ההנחה');return;}
  if(kind==='change'&&!needsFund&&!(changeFees&&hasFees)&&!v.changeDetails?.trim()){setError('יש לפרט לפחות שינוי אחד שסוכם');return;}
  if(healthRefused&&(!v.offerCoverage?.trim()||v.offerPresented!=='on')){setError('יש לתעד את ההצעה שהוצגה בפועל ולאשר שהלקוח בחר שלא להצטרף.');return;}
  const healthOffer=healthRefused?{coverage:v.offerCoverage.trim(),company:v.offerCompany?.trim()||'',premium:v.offerPremium??'',reason:v.refusalReason?.trim()||'',includeReason:v.includeRefusalReason==='on',offered:true,declined:true,at:new Date().toISOString()}:undefined;
  for(const key of ['offerCoverage','offerCompany','offerPremium','refusalReason','includeRefusalReason','offerPresented'])delete v[key];
  setError('');onSave({...existing,target:'',targetManager:'',track:'',fundId:'',fundPeriod:'',allocations:[],depositFee:'',balanceFee:'',targetPremium:'',...v,feeChangeRequested:kind==='change'&&changeFees,healthOffer,processVersion:4,productCategory:p.category,changeDetails:v.changeDetails||'',decisionRecorded:true,riders:isTarget(action)?riders:[],recommendation:recommendation.text,...(needsFund?target:{}),action,productId:p.id,proposedProduct:p.proposed?p:undefined,id:existing?.id||uid()});
 }
 return <details className="wf-discussion" data-product-id={p.id} open={open??false}>
 <summary><div><b>{p.category}</b><span>{p.proposed?'אין מוצר מדווח בתיק':`${p.company} · ${policyDisplay(p.policy)}`}</span></div><span className="wf-pill">{existing?.consolidationId?'מקור באיחוד קופות':existing?existing.action:'לדיון בפגישה'}</span></summary>
 <div className="wf-current"><div><small>גוף מנהל כיום</small><strong>{p.proposed?'אין מוצר מדווח':p.company}</strong></div><div><small>{savings?'מסלול השקעה כיום':'כיסויים מדווחים'}</small><strong>{savings?p.track||'לא דווח':p.coverage?.map(x=>x.name).join(' · ')||'אין מידע'}</strong></div><div><small>{savings?'דמי ניהול: הפקדה / צבירה':'פרמיה חודשית'}</small><strong>{savings?`${fee(p.depositFee)} / ${fee(p.balanceFee)}`:p.premium!=null?`${p.premium} ₪`:'לא דווח'}</strong></div></div>
 {p.warning&&<p className="wf-warning">⚠ {p.warning}</p>}
 {recommendation.text&&<div className="wf-current-recommendation"><b>ההמלצה מתיק המוצר</b><p style={{whiteSpace:'pre-line'}}>{recommendation.text}</p></div>}<form onSubmit={submit}><fieldset disabled={locked}><label className="wf-field"><span>מה סוכם בפגישה</span><select required value={action} onChange={e=>{setAction(e.target.value);setTarget(null);}}><option value="">בחר פעולה</option>{existing?.action&&!choices.includes(existing.action)&&<option>{existing.action}</option>}{choices.map(x=><option key={x}>{x}</option>)}</select></label>
 {savings&&kind==='change'&&<label className="wf-check"><TypedDate type="checkbox" checked={changeTrack} onChange={e=>{setChangeTrack(e.target.checked);setTarget(null);}}/>שינוי מסלול השקעה — הגשה יחד עם המינוי באמצעות SMS 2010</label>}
 {kind==='change'&&<label className="wf-check"><TypedDate type="checkbox" checked={changeFees} onChange={e=>setChangeFees(e.target.checked)}/>{savings?'סוכמה בקשת הנחה בדמי ניהול':'סוכמה בקשת הנחה בפרמיה'}</label>}
 {kind==='change'&&<Input label="שינויים נוספים שסוכמו (אם יש)" name="changeDetails" defaultValue={existing?.changeDetails} maxLength="500"/>}
 {needsFund&&<FundPicker key={`${p.id}-${action}`} product={p} action={action} initial={existing} onChange={setTarget}/>}
 {!savings&&isTarget(action)&&<div className="wf-fields"><label className="wf-field"><span>חברת ביטוח יעד</span><select name="target" required defaultValue={existing?.target||''}><option value="">בחר חברה</option>{providerOptions(p.category,existing?.target,p.company).map(x=><option key={x}>{x}</option>)}</select></label><Input label="פרמיה מוצעת לחודש" name="targetPremium" type="number" min="0" step="0.01" required defaultValue={existing?.targetPremium??recommendation.entries.premium?.proposedPremium}/></div>}
 {!savings&&kind==='change'&&changeFees&&<Input label="פרמיה חודשית שסוכמה לאחר השינוי" name="targetPremium" type="number" min="0" step="0.01" required defaultValue={existing?.targetPremium??recommendation.entries.premium?.proposedPremium}/>}
 {savings&&action&&kind!=='agent'&&action!==actions[0]&&(kind!=='change'||changeFees)&&<div className="wf-fields"><Input label="דמי ניהול מהפקדה שסוכמו (%)" name="depositFee" type="number" min="0" max="100" step="0.01" defaultValue={existing?.depositFee??recommendation.entries.depositFee?.proposedFee}/><Input label="דמי ניהול מצבירה שסוכמו (%)" name="balanceFee" type="number" min="0" max="100" step="0.01" defaultValue={existing?.balanceFee??recommendation.entries.balanceFee?.proposedFee} required={action==='שיפור דמי ניהול'}/></div>}
 {p.category==='בריאות'&&isTarget(action)&&<fieldset><legend>נספחי הבריאות שסוכמו</legend><p className="wf-muted">יש להזין את שם הנספח והמסלול המדויק בהתאם להצעה. האפשרויות אינן קטלוג מאומת של חברת הביטוח.</p>{healthRiders.map(r=><label className="wf-check" key={r}><TypedDate type="checkbox" checked={riders.includes(r)} onChange={e=>setRiders(e.target.checked?[...riders,r]:riders.filter(x=>x!==r))}/>{r}</label>)}<Input label="שם נספח / מסלול מדויק נוסף (רשות)" name="riderDetail" defaultValue={existing?.riderDetail}/></fieldset>}
 {['ביטוח חיים','מחלות קשות'].includes(p.category)&&isTarget(action)&&<Input label="סכום ביטוח מוצע" type="number" min="1" step="0.01" name="targetCoverage" required defaultValue={existing?.targetCoverage??recommendation.entries.premium?.proposedCoverage}/>}
 {!savings&&isTarget(action)&&<fieldset><legend>פרטים שסוכמו לבדיקה מול ההפקה</legend>{p.category==='ביטוח חיים'&&<Input label="המוטבים שסוכמו עם הלקוח" name="agreedBeneficiaries" required maxLength="1000" defaultValue={existing?.agreedBeneficiaries}/>}{!['ביטוח חיים','בריאות'].includes(p.category)&&<Input label="כיסוי ומסלול ביטוח שסוכמו" name="agreedCoverage" required maxLength="1000" defaultValue={existing?.agreedCoverage}/>}<Input label="תנאים והחרגות שסוכמו (לרבות ללא החרגות אם אושר)" name="agreedExclusions" required maxLength="1000" defaultValue={existing?.agreedExclusions}/><Input label="תאריך תחילת הביטוח שסוכם" name="agreedEffective" type="date" required defaultValue={existing?.agreedEffective}/></fieldset>}
 {healthRefused&&<fieldset><legend>תיעוד הצעת הבריאות והחלטת הלקוח</legend><p className="wf-muted">מתעדים רק את ההצעה שהוצגה בפועל. אין להסיק מהיעדר מוצר מדווח שאין ללקוח ביטוח.</p><label className="wf-field"><span>הכיסויים וההצעה שהוצגו בפועל</span><textarea name="offerCoverage" required maxLength="1600" defaultValue={existing?.healthOffer?.coverage}/></label><div className="wf-fields"><Input label="חברת ההצעה (אם נמסרה)" name="offerCompany" maxLength="150" defaultValue={existing?.healthOffer?.company}/><Input label="פרמיה חודשית שהוצעה (אם נמסרה)" name="offerPremium" type="number" min="0" step="0.01" defaultValue={existing?.healthOffer?.premium}/></div><label className="wf-check"><TypedDate type="checkbox" required name="offerPresented" defaultChecked={!!existing?.healthOffer?.offered}/>ההצעה הוצגה ללקוח והוא בחר שלא להצטרף בשלב זה</label><Input label="סיבת הסירוב שנמסרה — לתיעוד פנימי בלבד (רשות)" name="refusalReason" maxLength="500" defaultValue={existing?.healthOffer?.reason}/><label className="wf-check"><TypedDate type="checkbox" name="includeRefusalReason" defaultChecked={!!existing?.healthOffer?.includeReason}/>לכלול גם את סיבת הסירוב בסיכום ללקוח</label></fieldset>}
 <Input label="הערה קצרה למוצר (רשות)" name="reason" maxLength="240" defaultValue={existing?.reason}/>
 {error&&<p role="alert">{error}</p>}<button className="secondary" disabled={!action||needsFund&&!target}>שמירת החלטה למוצר</button>
 {existing&&!locked&&<button className="wf-link" type="button" onClick={()=>onRemove(existing.id)}>הסרת החלטה</button>}
 </fieldset>{locked&&<p className="wf-muted">{consolidationTarget?'זו קופת היעד של איחוד פתוח. תנאיה מנוהלים בהחלטת האיחוד; אין לפתוח לה מהלך מתנגש.':existing?.consolidationId?'המקור מנוהל כחלק מאיחוד קופות. ניתן להסיר טיוטת איחוד שלמה לפני יציאה לחתימה, לא לשנות מקור בנפרד.':'הפעולה כבר יצאה לחתימה. פרטי ההחלטה נשמרים כפי שנשלחו.'}</p>}</form></details>;
}

export default function MeetingSheet({client,onSaveDecision,onRemove,onSaveMeeting,onSend,onDownload,liveMail,mailUnavailableReason,onConsolidate,onRemoveConsolidation,onOpenConsolidation}) {
 const panel=useRef(null),[expanded,setExpanded]=useState({});
 const [category,setCategory]=useState('הכל');
 const [notes,setNotes]=useState(client.meetingNotes||''),[meetingDate,setMeetingDate]=useState(meetingDateFor(client));
 const products=client.products.filter(p=>!p.archived);
 const missingHealth=!products.some(p=>p.category==='בריאות');
 const proposed=client.decisions.find(d=>d.proposedProduct?.category==='בריאות')?.proposedProduct||{id:'proposed-health',category:'בריאות',name:'ביטוח בריאות',company:'',policy:'',coverage:[],proposed:true};
 const activeGroups=(client.consolidations||[]).filter(g=>!consolidationStatus(client,g).completed);
 const openTargets=activeGroups.map(g=>g.targetProductId);
 const groupedIds=activeGroups.flatMap(g=>[g.targetProductId,...g.sourceIds]);
 const discussionProducts=orderedProducts(products.filter(p=>!groupedIds.includes(p.id)));
 const allDiscussionProducts=orderedProducts([...discussionProducts,...(missingHealth&&products.length?[proposed]:[])]);
 const discussionCategories=[...new Set(allDiscussionProducts.map(p=>p.category))];
 const groupKey=activeGroups.map(g=>g.id).join('|');
 const previousGroupKey=useRef(groupKey);
 useEffect(()=>{if(previousGroupKey.current===groupKey)return;previousGroupKey.current=groupKey;if(!groupKey)return;const next=discussionProducts.find(p=>!decisionForProduct(client,p.id))||(missingHealth?proposed:null);setExpanded(Object.fromEntries([...discussionProducts,...(missingHealth?[proposed]:[])].map(p=>[p.id,p.id===next?.id])));},[groupKey]);
 const hasPending=products.some(p=>!openTargets.includes(p.id)&&!client.decisions.some(d=>d.productId===p.id));
 function saveAndAdvance(value){
  const ordered=allDiscussionProducts.filter(p=>category==='הכל'||p.category===category);
  const next=ordered[ordered.findIndex(p=>p.id===value.productId)+1];
  onSaveDecision(value,()=>{
   setExpanded(Object.fromEntries(ordered.map(p=>[p.id,p.id===next?.id])));
   requestAnimationFrame(()=>{
    const target=next?[...panel.current?.querySelectorAll('.wf-discussion')||[]].find(el=>el.dataset.productId===next.id)?.querySelector('summary'):panel.current?.querySelector('.wf-meeting-end input');
    target?.focus({preventScroll:true});target?.scrollIntoView({behavior:'smooth',block:'start'});
   });
  });
 }
 const summary=buildSummary({...client,meetingNotes:notes,meetingDate});
 return <section ref={panel} className="wf-panel wf-meeting" onToggleCapture={e=>{const id=e.target.dataset.productId;if(id){const isOpen=e.target.open;setExpanded(current=>current[id]===isOpen?current:{...current,[id]:isOpen});}}}><div className="wf-section-head"><div><h2>הפגישה — עוברים מוצר, מוצר</h2><p className="wf-muted">המצב הקיים מול מה שכדאי לעשות. ההחלטות כאן הן גם סיכום השיחה ללקוח.</p></div><span className="wf-pill">{currentDecisions(client).length} החלטות תועדו</span></div>
 <ConsolidationOverview client={client} onCreate={onConsolidate} onRemove={onRemoveConsolidation} onOpen={onOpenConsolidation}/>
 {missingHealth&&<div className="wf-warning"><b>⚠ לא מופיע ביטוח בריאות בתיק — חשוב להעלות את הנושא בפגישה</b><p>יש לברר אם קיים כיסוי שלא דווח ולהציע בדיקת התאמה. היעדר נתון אינו הוכחה שאין ביטוח.</p><a href="#health-discussion" onClick={()=>setCategory('בריאות')}>לדיון בביטוח בריאות ↓</a></div>}
 {!!products.length&&<div className="wf-filters" aria-label="קטגוריות בפגישה וסיכום">{['הכל',...productOrder].map(t=><button type="button" key={t} aria-pressed={category===t} onClick={()=>setCategory(t)}>{t}</button>)}</div>}
 {!products.length?<p>יש לקלוט תמונת מצב לפני הפגישה.</p>:discussionCategories.map(group=><div key={group} hidden={category!=='הכל'&&category!==group}><section className="wf-product-group" aria-label={`דיון במוצרי ${group}`}><h2>{group} <small>({allDiscussionProducts.filter(p=>p.category===group).length})</small></h2>{allDiscussionProducts.filter(p=>p.category===group).map(p=><div key={p.id} id={p.proposed?'health-discussion':undefined}><ProductDiscussion key={`${p.id}-${decisionForProduct(client,p.id)?.id||'new'}`} p={p} recommendation={recommendationFor(client,p.id)} decision={decisionForProduct(client,p.id)} open={expanded[p.id]} onSave={saveAndAdvance} onRemove={onRemove}/></div>)}</section></div>)}
 {!!products.length&&category!=='הכל'&&!discussionCategories.includes(category)&&<p className="wf-muted">אין מוצרים לדיון בקטגוריה הזו. מוצרים באיחוד מנוהלים בכרטיס האיחוד.</p>}
 <form className="wf-meeting-end" onSubmit={e=>{e.preventDefault();onSaveMeeting({meetingDate,meetingNotes:notes,meetingDone:true,summary,summarySent:false});}}>
 <div className="wf-fields"><Input label="תאריך הפגישה" type="date" required value={meetingDate} onChange={e=>setMeetingDate(e.target.value)}/><label className="wf-field"><span>מלל חופשי בסוף הסיכום (רשות)</span><textarea rows="2" maxLength="600" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="רק מה שלא כבר נאמר במוצרים"/></label></div>
 <button disabled={!client.decisions.length}>שמירת סיכום הפגישה</button>{hasPending&&<p className="wf-muted">יש מוצרים שעדיין לא תועדה לגביהם החלטה; הם לא יוצגו כהמלצה בסיכום.</p>}
 </form>
 <div className="wf-actions">{mailUnavailableReason?<p role="note">{mailUnavailableReason}</p>:liveMail?<StagingSummaryMail client={client} disabled={!client.meetingDone||!client.summary||notes!==client.meetingNotes||meetingDate!==client.meetingDate} onSend={onSend}/>:<button disabled={!client.meetingDone||!client.summary||notes!==client.meetingNotes||meetingDate!==client.meetingDate} onClick={onSend}>דימוי שליחת הסיכום ללקוח</button>}<button className="secondary" disabled={!client.summary} onClick={onDownload}>הורדת הסיכום</button>{!liveMail&&client.summarySent&&<span className="wf-pill">✓ נשלח בדמו</span>}</div>
 {client.summary&&<details className="wf-summary-preview"><summary>תצוגת הסיכום שנשמר — ללא הזנה חוזרת</summary><pre>{client.summary}</pre></details>}
 </section>;
}
