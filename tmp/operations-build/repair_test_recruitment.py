import os,sys,json,sqlite3
from pathlib import Path
root=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
sys.path.insert(0,str(root/'backend'))
path=Path(__file__).parent/'operations-demo.sqlite'
os.environ['DATABASE_URL']='sqlite:///'+path.as_posix()
from app.db.session import SessionLocal
from app.services.office_integration import rows,persist
from app.services.recruitment_simple import connect
import copy
with sqlite3.connect(path) as src,sqlite3.connect(path.with_name('before-new-recruitment-repair.sqlite')) as dest:src.backup(dest)
with SessionLocal() as db:
 c=next(c for c in rows(db) if c['id']=='ca99c274-44cd-4347-b729-39c2d30727b3')
 assert c['name']=='בדיקה אא'
 previous=copy.deepcopy(c)
 drafts=[d for d in c.get('decisions',[]) if d.get('officeFlow',{}).get('draft') and d.get('sourceSaleId')]
 for draft in drafts:
  p=connect(c,draft);print(json.dumps({'client':c['id'],'process':p['id'],'state':p['state']},ensure_ascii=False))
 if drafts:persist(db,c,previous,'תיקון חיבור גיוס הבדיקה לטיפול הפשוט');db.commit()
