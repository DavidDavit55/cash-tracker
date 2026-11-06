import os,sys,copy,sqlite3,json
from pathlib import Path
root=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations');sys.path.insert(0,str(root/'backend'))
path=Path(__file__).parent/'operations-demo.sqlite';os.environ['DATABASE_URL']='sqlite:///'+path.as_posix()
from app.db.session import SessionLocal
from app.services.office_integration import rows,persist
from app.services.recruitment_simple import connect
with sqlite3.connect(path) as src,sqlite3.connect(path.with_name('before-appointment-repair.sqlite')) as dest:src.backup(dest)
with SessionLocal() as db:
 c=next(c for c in rows(db) if c['id']=='ca99c274-44cd-4347-b729-39c2d30727b3');assert c['name']=='בדיקה אא'
 previous=copy.deepcopy(c)
 d=next((d for d in c['decisions'] if d.get('sourceSaleId')==7),None)
 if d:
  assert d['serviceFlow']['kind']=='appointment' and len(d['serviceFlow']['history'])==1
  original=copy.deepcopy(d);d['officeFlow']={'sourceSnapshot':copy.deepcopy(d['serviceFlow']['sourceSnapshot'])}
  p=connect(c,d,appointment=True);c['legacyDraftArchive'][-1]=original
  # Legacy service tasks reference this decision; retain them as completed history.
  for t in c.get('operationalTasks',[]):
   if t.get('decisionId')==d['id'] and t.get('source')!='simple-process':t.update(status='done',result='הועבר לטיפול מינוי הסוכן המקושר')
  persist(db,c,previous,'תיקון מינוי הבדיקה לטיפול פשוט מקושר');db.commit();print(p['id'])
