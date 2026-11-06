import sqlite3,json
from pathlib import Path
db=sqlite3.connect(Path(__file__).parent/'operations-demo.sqlite')
c=json.loads(db.execute('select payload from office_clients where id=?',('f159d4c1-4366-472d-b482-82dde107fee9',)).fetchone()[0])
ids=['15be386c-be72-4ea4-ae55-91d632910b09','efd5c9de-ba39-41a5-aab8-c02d748ce5e8','21631110-119d-477f-82b5-3cdf0883e232','91451366-97df-40eb-86ce-59d52dcc52a3']
for pid in ids:
 p=next(p for p in c['simpleProcesses'] if p['id']==pid)
 tasks=[t for t in c['operationalTasks'] if t.get('processId')==pid]
 assert p['state']=='done' and p['due'] is None
 assert len(tasks)==1 and tasks[0]['status']=='done'
 print(p['kind'],': done; one completed reminder; no due date')
