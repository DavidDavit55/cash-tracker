from pathlib import Path
import shutil,datetime
root=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
backup=root/'backups'/('four-flows-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
def edit(path,fn):
 p=root/path; old=p.read_text(encoding='utf-8'); new=fn(old)
 if new==old: raise RuntimeError('No change: '+path)
 b=backup/path;b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,b);p.write_text(new,encoding='utf-8')
def replace(s,a,b):
 if a not in s:raise RuntimeError('Missing: '+a[:100])
 return s.replace(a,b)
def backend(s):
 s=replace(s,"'change':'שינוי'","'change':'שינויים','appointment':'מינוי סוכן'")
 s=replace(s,"def next_title(p):",'''def automatic_days(p, repeat=False):
    if p['kind']=='production':return 3
    if p['kind']=='appointment' or p['kind']=='change' and p.get('serviceType') in ['investment','fees']:return 2 if repeat else 10
    return None

def policy_value(c,p):
    product=next((x for x in c.get('products',[]) if x['id']==p.get('productId')),None)
    return (product or {}).get('policy') or p.get('policy') or ''

def next_title(p):''')
 s=replace(s,"'יש לבחור הפקה, תביעה או שינוי'","'יש לבחור הצטרפות, מינוי סוכן, תביעה או שינוי'")
 s=replace(s,"'verified':False}","'verified':False,'serviceType':data.get('serviceType',''),'policy':short(data,'policy',False)}")
 s=replace(s,"state=p['state'];need(state not in ['done','stopped'],'הטיפול סגור')", """state=p['state'];need(action=='policy' or state not in ['done','stopped'],'הטיפול סגור')
        if action=='policy':
            number=short(data,'policy');need(len(number)<=100,'מספר פוליסה ארוך מדי')
            p['policy']=number
            product=next((x for x in c.get('products',[]) if x['id']==p.get('productId')),None)
            if product:product['policy']=number
        elif action=='send':""")
 s=replace(s,"        if action=='send':\n            need", "            need")
 s=replace(s,"due=biz(today()) if p['kind']=='production' else dated(data.get('due'))", "days=automatic_days(p);due=biz(today(),days) if days else dated(data.get('due'))")
 s=replace(s,"p['due']=biz(today()) if p['kind']=='production' else dated(data.get('due'))", "days=automatic_days(p,True);p['due']=biz(today(),days) if days else dated(data.get('due'))")
 s=replace(s,"company=short(data,'company'),modeConfirmed=True)","company=short(data,'company'),modeConfirmed=True,serviceType=data.get('serviceType',p.get('serviceType','')))")
 s=replace(s,"need(p.get('modeConfirmed',True)","need(p['kind']=='production' or policy_value(c,p),'יש להזין מספר פוליסה / חשבון לפני שליחה')\n            need(p.get('modeConfirmed',True)")
 s=replace(s,"need(all(data.get(k) is True", "need(policy_value(c,p),'יש להזין מספר פוליסה / חשבון שהופק')\n            need(all(data.get(k) is True")
 # Store replay-safe input evidence, including policy edits and outcomes.
 s=replace(s,"'action':action,'state':p['state']", "'action':action,'data':copy.deepcopy(data),'state':p['state']")
 return s
# Backend changes applied in first pass.

def dialog(s):
 s=replace(s,'KINDS,STATES,reply,transition','KINDS,STATES,reply,transition,automatic_days,policy_value')
 s=replace(s," stage=state.get('stage')",''' # New intents interrupt an unfinished question instead of being parsed as a date.
 from app.services.guided_creation import start_request, creation_step
 request=start_request(body)
 if request or state.get('stage','').startswith('create_'):
  result=creation_step(db,all_clients,state,body,event_id,client_id,request,ask)
  if result is not None:return finish(result)
 if body in ['סיכום','סיכום יומי','מה פתוח','מה יש לי היום'] or body.startswith(('מה המצב של ','מה העמלות של ')):
  return finish(respond(db,body,event_id,client_id,process_id))
 stage=state.get('stage')''')
 s=replace(s,"  if action=='send' and p.get('modeConfirmed') is False:","""  if action in ['send','verify'] and not policy_value(c,p) and (action=='verify' or p['kind']!='production'):
   state['stage']='policy';return finish({'changed':False,'reply':'מה מספר הפוליסה / החשבון של המוצר?'})
  if action=='send' and p.get('modeConfirmed') is False:""")
 s=replace(s,"action in ['send','wait'] and p['kind']!='production'", "action in ['send','wait'] and not automatic_days(p,action=='wait')")
 s=replace(s," if stage=='mode':", """ if stage=='policy':
  if not body or len(body)>100:return finish({'changed':False,'reply':'יש להזין מספר פוליסה / חשבון עד 100 תווים.'})
  return execute(c,p,'policy',{'policy':body})
 if stage=='mode':""")
 return s
# Dialog changes applied in first pass.

def desk(s):
 s=replace(s,"production:'הפקה',claim:'תביעה',change:'שינוי'","production:'הצטרפות',claim:'תביעה',change:'שינויים',appointment:'מינוי סוכן'")
 s=replace(s,"initialProcess=''}:{embeddedClient?:string;initialProcess?:string}","initialProcess='',initialProduct=''}:{embeddedClient?:string;initialProcess?:string;initialProduct?:string}")
 s=replace(s," const pending=", " const initialized=useRef(false)\n const [productId,setProductId]=useState(initialProduct),[policy,setPolicy]=useState(''),[serviceType,setServiceType]=useState('')\n const pending=")
 s=replace(s," async function act("," const linked=client?.products.find((x:any)=>x.id===(p?.productId||productId))\n const autoDays=p?.kind==='production'?3:p?.kind==='appointment'||p?.kind==='change'&&['investment','fees'].includes(p?.serviceType)?10:0\n async function act(")
 s=replace(s,"setMode(row.mode||'new');setDetail", "setMode(row.mode||'new');setPolicy(row.policy||clients.find(c=>c.id===row.clientId)?.products.find((x:any)=>x.id===row.productId)?.policy||'');setProductId(row.productId||'');setServiceType(row.serviceType||'');setDetail")
 a=s.index(' useEffect(()=>{if(embeddedClient');b=s.index(' async function askBot()',a)
 s=s[:a]+''' useEffect(()=>{if(initialized.current||!q.data)return;initialized.current=true;if(embeddedClient){setClientId(embeddedClient);const c=clients[0];const row=c?.processes.find((p:any)=>initialProcess?p.id===initialProcess:p.productId===initialProduct&&!['done','stopped'].includes(p.state));if(row)choose({...row,clientId:c.id})}},[q.data])
 function begin(){setCreating(true);setSelected('');setChecks({});setDetail('');setDue('');setNotice('');setKind('claim');setClientId(embeddedClient||clientId);setProductId(initialProduct||productId)}
 function selectProduct(id:string){setProductId(id);const x=client?.products.find((x:any)=>x.id===id);if(!x)return;setCompany(x.company||'');setPolicy(x.policy||'');const prior=client.processes.find((f:any)=>f.productId===id);if(prior){setCategory(prior.category);setProduct(prior.product)}else{const name=x.category||x.name;const aliases:Record<string,string>={'ביטוח חיים':'ריסק רגיל','חיים':'ריסק רגיל','השתלמות':'קרן השתלמות'};const name2=aliases[name]||name;const cat=Object.keys(products).find(k=>products[k].includes(name2));if(cat){setCategory(cat);setProduct(name2)}}}
''' + s[b:]
 s=replace(s,"async function askBot(){\n  if(!botText.trim())", "async function askBot(text=botText){\n  if(!text.trim())")
 s=replace(s,"botPending.current?.body!==botText)botPending.current={body:botText", "botPending.current?.body!==text)botPending.current={body:text")
 s=replace(s,"onClick={askBot}","onClick={()=>askBot()}")
 s=replace(s,"onClick={()=>setBotText(String(i+1))}","onClick={()=>{setBotText(choice);askBot(String(i+1))}}")
 s=replace(s,"onClick={()=>setBotText('התחל מחדש')}","onClick={()=>askBot('התחל מחדש')}")
 s=replace(s,"onClick={()=>{setCreating(true);setSelected('');setChecks({});setDetail('');setDue('');setNotice('')}}", "onClick={begin}")
 s=replace(s,"הפקות · תביעות · שינויים","מינוי סוכן · הצטרפות · שינויים · תביעה")
 s=replace(s,"const rows=clients.flatMap", "const rows=clients.flatMap")
 s=replace(s,"const visible=rows.filter(p=>filter===", "const visible=rows.filter(p=>!initialProduct||p.productId===initialProduct).filter(p=>filter===")
 s=replace(s,"   <label>קטגוריה<select",'''   <label>המוצר בתיק<select value={productId} onChange={e=>selectProduct(e.target.value)}><option value="">בחר מוצר</option>{client?.products.map((x:any)=><option key={x.id} value={x.id}>{x.name||x.category} · {x.company} · {x.policy||'ללא מספר'}</option>)}</select></label>
   <label>קטגוריה<select''')
 s=replace(s,"   <label>תזכורת ראשונה",'''   {kind==='change'&&<label>מה משנים?<select value={serviceType} onChange={e=>setServiceType(e.target.value)}><option value="">בחר סוג שינוי</option><option value="investment">מסלול השקעה</option><option value="fees">דמי ניהול</option><option value="other">פרטים, מוטבים, כיסוי או אחר</option></select></label>}
   <label>תזכורת ראשונה''')
 s=replace(s,"disabled={busy||!client||!company.trim()} onClick={()=>act('create',{kind,category,product,company,mode,due,detail})}","disabled={busy||!client||!company.trim()||!productId||kind==='change'&&!serviceType} onClick={()=>act('create',{kind,category,product,company,mode:kind==='production'?mode:'new',due,detail,productId,serviceType})}")
 s=replace(s,"  {p&&<section", "  {!creating&&p&&<section")
 s=replace(s,"   {p.state==='new'&&",'''   <div className="op-grid"><label>מספר פוליסה / חשבון<input aria-label="מספר פוליסה / חשבון" value={policy} onChange={e=>setPolicy(e.target.value)} placeholder="הזן את מספר הפוליסה" maxLength={100}/></label><button disabled={busy||!policy.trim()||policy===(linked?.policy||p.policy||'')} onClick={()=>act('policy',{policy})}>שמירת מספר פוליסה</button></div>
   {p.state==='new'&&''')
 s=replace(s,"||(p.kind!=='production'&&!due)","||(!autoDays&&!due)||p.kind!=='production'&&!(linked?.policy||p.policy)")
 s=replace(s,"{p.kind==='production'?' · עוד 3 ימי עסקים':''}","{autoDays?' · עוד '+(p.kind==='production'?3:2)+' ימי עסקים':''}")
 s=replace(s,"{!['done','stopped'].includes(p.state)&&<><details",'''{!['done','stopped'].includes(p.state)&&<><p>{autoDays?'לאחר שליחה: מעקב בעוד '+autoDays+' ימי עסקים.':'יש לבחור מועד מעקב לפני שליחה; אין זמן אחיד לכל תביעה או שינוי.'}</p>{!autoDays&&<label>מועד המעקב הבא<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>}{['sent','produced','followup'].includes(p.state)&&<label>פירוט הריג׳קט / התוצאה<textarea value={detail} onChange={e=>setDetail(e.target.value)} placeholder="מה חסר או מה בוצע?"/></label>}<details''')
 s=replace(s,"!checks.executionCorrect} onClick", "!checks.executionCorrect||!(linked?.policy||p.policy)} onClick")
 return s
edit('frontend/src/pages/OperationsDesk.tsx',desk)
edit('frontend/src/pages/OfficePage.tsx',lambda s:replace(s,"key={c.id+(params.get('process')||'')} embeddedClient={c.id} initialProcess={params.get('process')||''}","key={c.id+(params.get('process')||'')+(params.get('product')||'')} embeddedClient={c.id} initialProcess={params.get('process')||''} initialProduct={params.get('product')||''}"))
def cards(s):
 s=replace(s,"<p>מספר פוליסה / חשבון: <b dir=\"ltr\">{p.policy||'טרם הוזן'}</b></p>","<PolicyNumber client={client} product={p}/>")
 a=s.index('{simple.map(q=>');b=s.index('{decisions.filter',a)
 s=s[:a]+'''{client.simpleOperations&&<p><Link className="office-primary" to={'/office?'+new URLSearchParams({client:client.id,tab:'process',product:p.id})}>תפעול המוצר</Link></p>}{simple.length>0&&<details><summary>טיפולים קודמים ופתוחים ({simple.length})</summary>{simple.map(q=><p key={q.id}><Link to={'/office?'+new URLSearchParams({client:client.id,tab:'process',process:q.id})}>{({production:'הצטרפות',claim:'תביעה',change:'שינויים',appointment:'מינוי סוכן'}[q.kind]||'טיפול')+' · '+(['done','stopped'].includes(q.state)?'סגור':'פתוח')}</Link></p>)}</details>}''' +s[b:]
 s="import {api} from '@/api/client';\n"+s
 s+='''
function PolicyNumber({client,product}){
 const [editing,setEditing]=useState(false),[value,setValue]=useState(product.policy||''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function save(){setBusy(true);setError('');try{await api.post('/operations/product-policy',{clientId:client.id,revision:client.revision,productId:product.id,policy:value,eventId:crypto.randomUUID()});setEditing(false);window.dispatchEvent(new Event('office-changed'))}catch(e){setError(e.response?.data?.detail||'לא נשמר. נסה שוב.')}finally{setBusy(false)}}
 return <div><button className="office-secondary" onClick={()=>setEditing(!editing)}>מספר פוליסה / חשבון: {product.policy||'לחץ להזנה'}</button>{editing&&<div><label>מספר פוליסה<input value={value} onChange={e=>setValue(e.target.value)} maxLength={100}/></label><button disabled={busy||!value.trim()} onClick={save}>שמירת מספר</button></div>}{error&&<p role="alert">{error}</p>}</div>
}
'''
 return s
edit('frontend/src/pages/OfficeProducts.jsx',cards)
edit('backend/app/api/routes/simple_operations.py',lambda s:s+'''
class PolicyEdit(BaseModel):
    clientId:str
    revision:int=Field(ge=1)
    productId:str
    policy:str=Field(min_length=1,max_length=100)
    eventId:str=Field(min_length=1,max_length=100)

@router.post('/product-policy')
def product_policy(b:PolicyEdit,db:Session=Depends(get_db)):
    c=record(db,b.clientId)
    product=next((p for p in c.get('products',[]) if p['id']==b.productId),None)
    if not product:raise HTTPException(404,'המוצר לא נמצא בתיק')
    value=b.policy.strip()
    if not value:raise HTTPException(400,'יש להזין מספר פוליסה')
    if product.get('policy')==value:return {'saved':True}
    product['policy']=value
    for p in c.get('simpleProcesses',[]):
        if p.get('productId')==b.productId:p['policy']=value
    save(db,c,b.revision,'עודכן מספר פוליסה / חשבון למוצר')
    return {'saved':True}
''')
print('Updated; backup:',backup)
