import sys,json,sqlite3,copy
from pathlib import Path
root=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations');sys.path.insert(0,str(root/'backend'))
from app.services.recruitment_simple import connect
path=Path(__file__).parent/'operations-demo.sqlite'
db=sqlite3.connect(path);db.row_factory=sqlite3.Row
cid='02c955f2-0b76-46bb-90b5-626d1843abc9'
r=db.execute('SELECT * FROM office_clients WHERE id=?',(cid,)).fetchone();c=json.loads(r['payload'])
assert c['name']=='אברהם לוטה — עותק בדיקה'
backup=path.with_name('before-simple-bridge.sqlite');dest=sqlite3.connect(backup);db.backup(dest);dest.close()
c['simpleOperations']=True
for d in list(c['decisions']):
 if d.get('officeFlow',{}).get('draft'):connect(c,d)
db.execute('UPDATE office_clients SET payload=?,revision=revision+1 WHERE id=? AND revision=?',(json.dumps(c,ensure_ascii=False),cid,r['revision']));db.commit()
assert len(c['simpleProcesses'])==1 and len(c['products'])==1
print('One product, one simple process, one task; legacy draft archived. State:',c['simpleProcesses'][0]['state'])
