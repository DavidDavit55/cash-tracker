from pathlib import Path
import shutil,datetime
p=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations\frontend\src\pages\OperationsDesk.tsx')
shutil.copy2(p,p.with_suffix('.tsx.verify-'+datetime.datetime.now().strftime('%H%M%S')+'.bak'))
s=p.read_text(encoding='utf-8')
s=s.replace("setCreating(false);setChecks({});setDetail('')", "setCreating(false);if(action!=='policy'){setChecks({});setDetail('')}")
s=s.replace("(p.kind!=='production'||p.history.some((h:any)=>h.action==='result'))", "(p.kind!=='production'||p.state!=='produced'&&p.history.some((h:any)=>h.action==='result'))")
marker=' const check=(key:string,label:string)=>'
helper=""" const savedPolicy=linked?.policy||p?.policy||''
 const verifyMissing=[
  !savedPolicy?'מספר פוליסה / חשבון — יש להזין ולשמור כאן':policy.trim()!==savedPolicy?'שמירת השינוי במספר הפוליסה / החשבון':null,
  !checks.detailsCorrect?'אישור פרטי הלקוח והמוצר':null,
  !checks.termsCorrect?'אישור שהתנאים תואמים לסיכום':null,
  !checks.executionCorrect?'אישור בדיקת הביצוע':null,
  p?.mode==='replace'&&!effective?'תאריך תחילת הפוליסה החדשה':null,
  p?.mode==='transfer'&&!due?'מועד מעקב ניוד':null,
 ].filter(Boolean)
"""
assert marker in s;s=s.replace(marker,helper+marker)
heading='<h3>בדיקת הפקה מול מה שסוכם</h3>'
inline='''<div className="op-grid"><label>מספר פוליסה / חשבון שהופק<input aria-label="מספר פוליסה / חשבון שהופק" value={policy} onChange={e=>setPolicy(e.target.value)} placeholder="הזן את המספר שקיבלת מהחברה" maxLength={100}/></label><button disabled={busy||!policy.trim()||policy.trim()===savedPolicy} onClick={()=>act('policy',{policy:policy.trim()})}>שמירת מספר פוליסה</button></div>{savedPolicy&&policy.trim()===savedPolicy&&<p role="status">מספר הפוליסה שמור: {savedPolicy}</p>}'''
s=s.replace(heading,heading+inline)
old="<button disabled={busy||!checks.detailsCorrect||!checks.termsCorrect||!checks.executionCorrect||!(linked?.policy||p.policy)||p.mode==='replace'&&!effective||p.mode==='transfer'&&!due} onClick={()=>act('verify',{...checks,effective,due})}>בדקתי והכול תקין</button>"
new='''{verifyMissing.length>0&&<div id="verify-missing" role="status" aria-live="polite"><strong>כדי להמשיך חסר:</strong><ul>{verifyMissing.map(item=><li key={item}>{item}</li>)}</ul></div>}<button aria-describedby={verifyMissing.length?'verify-missing':undefined} disabled={busy||verifyMissing.length>0} onClick={()=>act('verify',{...checks,effective,due})}>{busy?'שומר…':'בדקתי והכול תקין'}</button>'''
assert old in s;s=s.replace(old,new);p.write_text(s,encoding='utf-8')
