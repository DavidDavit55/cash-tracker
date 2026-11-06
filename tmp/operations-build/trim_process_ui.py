from pathlib import Path
import shutil,datetime
r=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
b=r/'backups'/('stage-fields-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'));b.mkdir(parents=True)
for name in ['OperationsDesk.tsx','OfficePage.tsx']:
 p=r/'frontend/src/pages'/name;shutil.copy2(p,b/name);s=p.read_text(encoding='utf-8')
 if name=='OperationsDesk.tsx':
  old='<div className="op-grid"><label>מספר פוליסה / חשבון'
  assert old in s
  s=s.replace(old,"{(p.kind!=='production'||p.history.some((h:any)=>h.action==='result'))&&<div className=\"op-grid\"><label>מספר פוליסה / חשבון")
  s=s.replace('>שמירת מספר פוליסה</button></div>','>שמירת מספר פוליסה</button></div>}')
 else:
  s=s.replace("['documents','tasks'].includes(id)","['documents','tasks','history'].includes(id)")
  marker=" const c=clients.find(c=>c.id===selected)"
  s=s.replace(marker,marker+"\n useEffect(()=>{if((c as any)?.simpleOperations&&tab==='history')setTab('process')},[c?.id,(c as any)?.simpleOperations,tab])")
  s=s.replace("{tab==='history'&&<>","{tab==='history'&&!(c as any).simpleOperations&&<>")
 p.write_text(s,encoding='utf-8')
print('Policy field appears after issuance in joining; history tab removed from simple operations.')
