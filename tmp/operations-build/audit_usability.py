from pathlib import Path
import shutil,datetime
r=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
backup=r/'backups'/('usability-audit-'+datetime.datetime.now().strftime('%H%M%S'));backup.mkdir()
def edit(rel,fn):
 p=r/rel;shutil.copy2(p,backup/p.name);s=p.read_text(encoding='utf-8');p.write_text(fn(s),encoding='utf-8')
def desk(s):
 s=s.replace("setCreating(true);setSelected('');setChecks({})","setCreating(true);setSelected('');setServiceType('');setOutcome('payment');setMode('new');setError('');setTime('');setChecks({})")
 s=s.replace("if(!x)return;setCompany", "if(!x){setCompany('');setPolicy('');return}setCompany")
 s=s.replace("'השתלמות':'קרן השתלמות'","'השתלמות':'קרן השתלמות','קרן פנסיה':'פנסיה','ביטוח בריאות':'בריאות'")
 s=s.replace("||(!initialProcess&&!initialProduct&&c.processes.length===1?c.processes[0]:undefined)","||(!initialProcess&&initialProduct?[...c.processes].reverse().find((p:any)=>p.productId===initialProduct):undefined)||(!initialProcess&&!initialProduct&&c.processes.length===1?c.processes[0]:undefined)")
 s=s.replace("if(action!=='policy'){setChecks({});setDetail('')}","if(!['policy','remind','details'].includes(action)){setChecks({});setDetail('')}")
 marker=" const check=(key:string,label:string)=>"
 additions=""" const missing=(items:any[])=>{const values=items.filter(Boolean);return values.length?<p role="status" className="op-missing">כדי להמשיך: {values.join(' · ')}</p>:null}
 const sendMissing=[!p?.company&&'השלמת חברה',!p?.product&&'בחירת מוצר',p?.modeConfirmed===false&&'בחירת חדש / שחלוף / ניוד ושמירת פרטי הטיפול',!autoDays&&!due&&'בחירת מועד מעקב',p?.kind!=='production'&&!savedPolicy&&'הזנה ושמירה של מספר הפוליסה / החשבון הקיים']
"""
 assert marker in s;s=s.replace(marker,additions+marker)
 s=s.replace("{['new','reject'].includes(p.state)&&p.kind!=='production'&&!(linked?.policy||p.policy)&&<p role=\"status\">כדי לסמן שנשלח לחברה: הזן ושמור למעלה את מספר הפוליסה / החשבון הקיים שאליו מתייחס הטיפול.</p>}","{['new','reject'].includes(p.state)&&missing(sendMissing)}")
 s=s.replace("<button disabled={busy||!client||!company.trim()||!productId", "{missing([!client&&'בחירת לקוח',!productId&&'בחירת מוצר בתיק',!!productId&&!company.trim()&&'השלמת החברה במוצר',kind==='change'&&!serviceType&&'בחירת סוג שינוי',newCase&&!caseDescription.trim()&&'תיאור האירוע החדש'])}<button disabled={busy||!client||!company.trim()||!productId")
 # A single visible result/reject field; a dedicated reason inside stop, including new/handled states.
 s=s.replace('<label>פירוט החוסר / התוצאה<textarea value={detail} onChange={e=>setDetail(e.target.value)}/></label>','')
 s=s.replace('<p>יש למלא סיבה בשדה הפירוט. התזכורת תיסגר וההיסטוריה תישמר.</p>','<label>סיבת הסגירה<textarea value={detail} onChange={e=>setDetail(e.target.value)} placeholder="למה הטיפול נסגר ללא ביצוע?"/></label>')
 s=s.replace("<button disabled={busy||!checks.verified||!detail.trim()} onClick={()=>act('result'", "{missing([!checks.verified&&'סימון שהתוצאה נבדקה',!detail.trim()&&'תיאור קצר של התוצאה בשדה הפירוט'])}<button disabled={busy||!checks.verified||!detail.trim()} onClick={()=>act('result'")
 s=s.replace("{['sent','produced'].includes(p.state)&&<button", "{['sent','produced'].includes(p.state)&&missing([!detail.trim()&&'לתיעוד ריג׳קט: פירוט החוסר',!due&&'לתיעוד ריג׳קט: בחירת מועד מעקב'])}{['sent','produced'].includes(p.state)&&<button")
 s=s.replace("<button disabled={busy||!checks.verified||!detail.trim()} onClick={()=>act('followup'", "{missing([!checks.verified&&'אישור ביצוע הביטול / הניוד',!detail.trim()&&'תיאור קצר של הבדיקה בשדה הפירוט'])}<button disabled={busy||!checks.verified||!detail.trim()} onClick={()=>act('followup'")
 s=s.replace("{check('customerUpdated','עדכנתי את הלקוח בפועל')}<button", "{check('customerUpdated','עדכנתי את הלקוח בפועל')}{missing([!checks.customerUpdated&&'סימון שהלקוח עודכן בפועל'])}<button")
 # Do not disable missing information merely because a product is linked.
 s=s.replace('קטגוריית הטיפול<select disabled={!!productId}', 'קטגוריית הטיפול<select')
 s=s.replace('מוצר לטיפול<select disabled={!!productId}', 'מוצר לטיפול<select')
 s=s.replace('חברה לטיפול<input disabled={!!productId}', 'חברה לטיפול<input')
 # product-only page with no processes must offer an actionable start.
 s=s.replace("  {!creating&&p&&<section", "  {!creating&&!p&&initialProduct&&<section className=\"office-card\"><p>אין טיפול פתוח למוצר הזה.</p><button onClick={begin}>פתיחת טיפול למוצר</button></section>}\n  {!creating&&p&&<section")
 return s
edit('frontend/src/pages/OperationsDesk.tsx',desk)
edit('backend/app/services/simple_process.py',lambda s:s.replace("processes.append(p)","processes.append(p)\n        c['simpleOperations']=True"))
def status(s):
 s=s.replace("if(!flow)return null;", """if(!flow){
  const appointment=(client.simpleProcesses||[]).filter(p=>p.productId===product.id&&p.kind==='appointment'&&p.state!=='stopped').sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0];
  if(!appointment||product.commissionPolicy?.status==='active')return null;
  return {label:appointment.verified?'מינוי סוכן נקלט':'ממתין למינוי סוכן',tone:appointment.verified?'verified':'pending',detail:appointment.verified?'אומת שהמינוי נקלט בחברה; זהו מוצר קיים, לא הפקה חדשה.':'מוצר קיים בטיפול מינוי סוכן. אין מדובר בהפקה חדשה.'};
 }
""")
 return s.replace('flow.agreed?.effective||product.effective','flow.effective||flow.agreed?.effective||product.effective')
edit('frontend/src/pages/simple-product-status.js',status)
print('Updated four files; original copies:',backup)
