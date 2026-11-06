from pathlib import Path
import shutil,datetime
root=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
p=root/'backend/app/api/routes/office.py';s=p.read_text(encoding='utf-8')
needle="  if not task: raise HTTPException(404,'משימה לא נמצאה')\n  state=d.get('status')"
assert needle in s
b=root/'backups'/('operations-guard-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))/'office.py';b.parent.mkdir(parents=True);shutil.copy2(p,b)
s=s.replace(needle,"  if not task: raise HTTPException(404,'משימה לא נמצאה')\n  if task.get('source')=='simple-process':raise HTTPException(400,'יש לעדכן את הטיפול בשולחן העבודה; המשימה מתעדכנת ממנו אוטומטית')\n  state=d.get('status')")
p.write_text(s,encoding='utf-8')
print('Protected process tasks from independent manual completion')
