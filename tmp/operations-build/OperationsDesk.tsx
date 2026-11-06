import {useState,useRef} from 'react'
import {useQuery} from '@tanstack/react-query'
import {api} from '@/api/client'
import {AppShell} from '@/components/layout/AppShell'
import './OperationsDesk.css'

const kinds:Record<string,string>={production:'הפקה',claim:'תביעה',change:'שינוי'}
const states:Record<string,string>={new:'חדש',sent:'נשלח לחברה',reject:'ריג׳קט',produced:'הופק',followup:'ביטול / ניוד',handled:'טופל',done:'הושלם',stopped:'נסגר ללא ביצוע'}
const products:Record<string,string[]>={'בריאות':['בריאות','מחלות קשות'],'חיים':['ריסק רגיל','ריסק משכנתא'],'פנסיה':['פנסיה'],'פיננסים':['גמל','גמל להשקעה','קרן השתלמות']}
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem'}).format(new Date())
export default function OperationsDesk(){
 const pending=useRef<{key:string,eventId:string}|null>(null)
 const [botText,setBotText]=useState(''),[botReply,setBotReply]=useState('')
 const botPending=useRef<{body:string,eventId:string}|null>(null)
 const q=useQuery({queryKey:['simple-operations'],queryFn:async()=>(await api.get('/operations')).data,refetchInterval:15000})
 const [clientId,setClientId]=useState(''),[selected,setSelected]=useState(''),[kind,setKind]=useState('production'),[category,setCategory]=useState('בריאות'),[product,setProduct]=useState('בריאות'),[company,setCompany]=useState(''),[mode,setMode]=useState('new'),[filter,setFilter]=useState('all'),[due,setDue]=useState(''),[time,setTime]=useState(''),[detail,setDetail]=useState(''),[body,setBody]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[checks,setChecks]=useState<Record<string,boolean>>({}),[creating,setCreating]=useState(false)
 const clients:any[]=q.data?.clients||[],client=clients.find(c=>c.id===clientId),p=client?.processes.find((p:any)=>p.id===selected)
 const rows=clients.flatMap(c=>c.processes.map((p:any)=>({...p,clientId:c.id,clientName:c.name})))
 const visible=rows.filter(p=>filter==='all'||filter==='open'&&!['done','stopped'].includes(p.state)||filter===p.kind||filter==='today'&&p.due&&p.due<=day()&&!['done','stopped'].includes(p.state))
 async function act(action:string,values:any={},simulate=false){
  if(!client){setError('יש לבחור לקוח');return}setBusy(true);setError('');setNotice('')
  const key=JSON.stringify({clientId,selected,action,values,body:simulate?body:null})
  if(pending.current?.key!==key)pending.current={key,eventId:crypto.randomUUID()}
  try{const r=(await api.post('/operations/'+(simulate?'simulate':'actions'),{clientId,revision:client.revision,processId:selected||null,eventId:pending.current.eventId,action,values,...(simulate?{body}:{} )})).data
   pending.current=null;setNotice(r.reply);if(r.process){setSelected(r.process.id);setDue(r.process.due||'');setTime(r.process.dueTime||'');setCreating(false);setChecks({});setDetail('')}await q.refetch()
  }catch(e:any){if(e.response?.status>=400&&e.response?.status<500)pending.current=null;setError(e.response?.data?.detail||'השמירה לא אושרה. ניסיון חוזר של אותה פעולה לא ייצור כפילות.');await q.refetch()}finally{setBusy(false)}
 }
 function choose(row:any){setClientId(row.clientId);setSelected(row.id);setCreating(false);setDue(row.due||'');setTime(row.dueTime||'');setCompany(row.company||'');setCategory(row.category||'בריאות');setProduct(row.product||'בריאות');setMode(row.mode||'new');setDetail('');setChecks({});setError('');setNotice('')}
 async function askBot(){
  if(!botText.trim())return;setBusy(true);setError('')
  if(botPending.current?.body!==botText)botPending.current={body:botText,eventId:crypto.randomUUID()}
  try{const r=(await api.post('/operations/bot-preview',botPending.current)).data;botPending.current=null;setBotReply(r.reply);if(r.process)choose({...r.process,clientId:r.clientId});await q.refetch()}
  catch(e:any){if(e.response?.status>=400&&e.response?.status<500)botPending.current=null;setError(e.response?.data?.detail||'לא התקבל אישור. ניתן לנסות שוב את אותה הודעה ללא כפילות.')}finally{setBusy(false)}
 }
 const check=(key:string,label:string)=><label className="op-check"><input type="checkbox" checked={!!checks[key]} onChange={e=>setChecks({...checks,[key]:e.target.checked})}/>{label}</label>
 return <AppShell><main className="office op-desk" dir="rtl">
  <header className="office-heading"><div><small>הפקות · תביעות · שינויים</small><h1>שולחן העבודה</h1><p>טיפול אחד, פעולה הבאה ותזכורת אחת.</p></div><button onClick={()=>{setCreating(true);setSelected('');setChecks({});setDetail('');setDue('');setNotice('')}}>פתיחת טיפול</button></header>
  <aside className="op-banner">גרסת בדיקה מקומית · הודעות הבוט כאן הן סימולציה. תזכורות וואטסאפ, יומן וסיכום 19:00 עדיין לא מופעלים.</aside>
  <div className="office-stats"><button className="office-card" onClick={()=>setFilter('open')}>פתוחים <strong>{q.data?.open||0}</strong></button><button className="office-card" onClick={()=>setFilter('today')}>להיום <strong>{q.data?.today||0}</strong></button><div className="office-card">באיחור <strong>{q.data?.overdue||0}</strong></div><div className="office-card">ללא מועד <strong>{q.data?.undated||0}</strong></div></div>
  {q.isError&&<p role="alert">לא ניתן לטעון. <button onClick={()=>q.refetch()}>ניסיון חוזר</button></p>}
  {error&&<p className="op-error" role="alert">{error}</p>}{notice&&<p className="op-reply" role="status">{notice}</p>}
  <section className="office-card"><h2>העוזר שלי — בדיקה מקומית</h2><p>כתוב ״פתח תביעה ל״ ואחריו שם לקוח מלא, או ״סיכום״. ההודעה נשמרת כאן בלבד ואינה נשלחת בוואטסאפ.</p><label>הוראה לעוזר<input value={botText} onChange={e=>setBotText(e.target.value)} placeholder="פתח תביעה לדמה #02 — תביעת בריאות"/></label><button disabled={busy||!botText.trim()} onClick={askBot}>ביצוע הוראה מקומית</button>{botReply&&<p className="op-reply" role="status">{botReply}</p>}</section>
  {creating&&<section className="office-card"><h2>טיפול חדש</h2><div className="op-grid">
   <label>לקוח קיים<select value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">בחר לקוח</option>{clients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
   <label>סוג טיפול<select value={kind} onChange={e=>{setKind(e.target.value);setMode('new')}}>{Object.entries(kinds).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
   <label>קטגוריה<select value={category} onChange={e=>{setCategory(e.target.value);setProduct(products[e.target.value][0]);setMode('new')}}>{Object.keys(products).map(v=><option key={v}>{v}</option>)}</select></label>
   <label>מוצר<select value={product} onChange={e=>setProduct(e.target.value)}>{products[category].map(v=><option key={v}>{v}</option>)}</select></label>
   <label>חברה<input value={company} onChange={e=>setCompany(e.target.value)}/></label>
   {kind==='production'&&<label>מסלול<select value={mode} onChange={e=>setMode(e.target.value)}><option value="new">חדש</option>{['בריאות','חיים'].includes(category)?<option value="replace">שחלוף</option>:<option value="transfer">ניוד</option>}</select></label>}
   <label>תזכורת ראשונה — אפשר להשלים בהמשך<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>
  </div><p>ייפתח בסטטוס חדש. לא נוצרים גיוס, מוצר או פוליסה נוספים.</p><button disabled={busy||!client||!company.trim()} onClick={()=>act('create',{kind,category,product,company,mode,due,detail})}>פתיחת טיפול בסטטוס חדש</button></section>}
  <section className="office-card"><div className="office-heading"><h2>הטיפולים שלי</h2><select aria-label="סינון טיפולים" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">הכול, כולל סגורים</option><option value="open">פתוחים</option><option value="today">להיום ובאיחור</option>{Object.entries(kinds).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div><div className="office-table"><table><thead><tr><th>לקוח</th><th>טיפול</th><th>חברה</th><th>מצב</th><th>תזכורת</th><th/></tr></thead><tbody>{visible.map(row=><tr key={row.id}><td>{row.clientName}</td><td>{kinds[row.kind]} · {row.product}</td><td>{row.company}</td><td><span className={'op-state '+row.state}>{states[row.state]}</span></td><td>{row.due||'לא נקבע'} {row.dueTime}</td><td><button onClick={()=>choose(row)}>פתיחת טיפול</button></td></tr>)}</tbody></table>{!visible.length&&<p>אין טיפולים בתצוגה הזאת.</p>}</div></section>
  {p&&<section className="office-card op-workspace"><h2>{client.name} · {kinds[p.kind]} · {p.product} · {p.company}</h2><p>#{p.id.slice(0,8)} · <strong>{states[p.state]}</strong></p>
   {p.state==='new'&&(!p.company||!p.product||p.modeConfirmed===false)&&<div className="op-grid"><p>הטיפול כבר נפתח. השלם רק את הפרטים החסרים לפני שליחה.</p><label>קטגוריית הטיפול<select value={category} onChange={e=>{setCategory(e.target.value);setProduct(products[e.target.value][0]);setMode('new')}}>{Object.keys(products).map(v=><option key={v}>{v}</option>)}</select></label><label>מוצר לטיפול<select value={product} onChange={e=>setProduct(e.target.value)}>{products[category].map(v=><option key={v}>{v}</option>)}</select></label><label>חברה לטיפול<input value={company} onChange={e=>setCompany(e.target.value)}/></label>{p.kind==='production'&&<label>סוג ההפקה<select value={mode} onChange={e=>setMode(e.target.value)}><option value="new">חדש</option>{['בריאות','חיים'].includes(category)?<option value="replace">שחלוף</option>:<option value="transfer">ניוד</option>}</select></label>}<button disabled={busy||!company.trim()} onClick={()=>act('details',{category,product,company,mode:p.kind==='production'?mode:'new'})}>שמירת פרטי הטיפול</button></div>}
   {p.detail&&<p className="op-banner">{p.detail}</p>}
   {!['done','stopped'].includes(p.state)&&<><div className="op-grid"><label>מועד המעקב<input type="date" value={due} onChange={e=>setDue(e.target.value)}/><button type="button" onClick={()=>setDue(day())}>בחירת היום</button></label><label>שעה — לפי שעון ישראל<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><label>פירוט החוסר / התוצאה<textarea value={detail} onChange={e=>setDetail(e.target.value)}/></label></div>
    <div className="op-actions"><button disabled={busy||!due} onClick={()=>act('remind',{due,time})}>עדכון תזכורת</button>
    {['new','reject'].includes(p.state)&&<button disabled={busy||!p.company||!p.product||p.modeConfirmed===false||(p.kind!=='production'&&!due)} onClick={()=>act('send',{due})}>{p.state==='reject'?'השלמתי ושלחתי שוב':'נשלח לחברה'}</button>}
    {p.state==='sent'&&<><button disabled={busy||(p.kind!=='production'&&!due)} onClick={()=>act('wait',{due})}>עדיין ממתין{p.kind==='production'?' · עוד 3 ימי עסקים':''}</button>{p.kind==='production'?<button disabled={busy} onClick={()=>act('result')}>הופק</button>:<>{check('verified','בדקתי שהתוצאה בוצעה בפועל; בתביעת תשלום — שהכסף התקבל')}<button disabled={busy||!checks.verified||!detail.trim()} onClick={()=>act('result',{verified:checks.verified,detail})}>טופל</button></>}</>}
    {['sent','produced'].includes(p.state)&&<button disabled={busy||!due||!detail.trim()} onClick={()=>act('reject',{detail,due})}>ריג׳קט / פער לטיפול</button>}</div>
    {p.state==='produced'&&<div className="op-checklist"><h3>בדיקת הפקה מול מה שסוכם</h3>{check('detailsCorrect','פרטי הלקוח והמוצר נכונים')}{check('termsCorrect','התנאים תואמים לסיכום עם הלקוח')}{check('executionCorrect','הביצוע נבדק, כולל הפקדה ושיוך כאשר נדרשים')}<button disabled={busy||!checks.detailsCorrect||!checks.termsCorrect||!checks.executionCorrect} onClick={()=>act('verify',checks)}>בדקתי והכול תקין</button></div>}
    {p.state==='followup'&&<div>{check('verified',p.mode==='replace'?'אימתתי ביטול הפוליסה הקודמת':'אימתתי שהניוד הושלם')}<button disabled={busy||!checks.verified||!detail.trim()} onClick={()=>act('followup',{verified:checks.verified,detail})}>המעקב הושלם</button></div>}
    {p.state==='handled'&&<div>{check('customerUpdated','עדכנתי את הלקוח בפועל')}<button disabled={busy||!checks.customerUpdated} onClick={()=>act('close',checks)}>סיום טיפול</button></div>}
    <details><summary>סגירה ללא ביצוע</summary><p>יש למלא סיבה בשדה הפירוט. התזכורת תיסגר וההיסטוריה תישמר.</p><button disabled={busy||!detail.trim()} onClick={()=>act('stop',{detail})}>סגירה ללא ביצוע</button></details>
    <section className="op-simulator"><h3>בדיקת הודעה לבוט</h3><p>סימולטור פנימי בלבד. כרגע מבין: ״נשלח״, ״שלחתי שוב״, ״עדיין ממתין״, ״הופק״. פעולות נוספות נעשות בכפתורים למעלה.</p><label>הודעה<input value={body} onChange={e=>setBody(e.target.value)} placeholder="לדוגמה: עדיין ממתין"/></label><button disabled={busy||!body.trim()} onClick={()=>act('message',{due},true)}>שליחת הודעה בסימולטור</button></section>
   </>}
   <details><summary>היסטוריה · {p.history.length} פעולות</summary>{p.history.map((h:any)=><p key={h.id}>{new Date(h.at).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'})} · {states[h.state]} {h.detail} {h.due&&' · מעקב '+h.due}</p>)}</details>
  </section>}
 </main></AppShell>
}
