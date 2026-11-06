from pathlib import Path
import sqlite3,json,datetime,uuid
root=Path(__file__).resolve().parent
path=(root/'operations-demo.sqlite').resolve()
assert path.parent==root and path.name=='operations-demo.sqlite' and path.exists()
cid='02c955f2-0b76-46bb-90b5-626d1843abc9'
db=sqlite3.connect(path);db.execute('BEGIN IMMEDIATE')
row=db.execute('SELECT revision,payload,commission_id FROM office_clients WHERE id=?',(cid,)).fetchone()
assert row and row[2] is None
c=json.loads(row[1]);assert c['name']=='אברהם לוטה — עותק בדיקה' and c.get('testOnly') is True and c['source']=='isolated-test-copy'
others=dict(db.execute('SELECT id,payload FROM office_clients WHERE id<>?',(cid,)).fetchall())
stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
(root/('avraham-before-reset-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.json')).write_text(row[1],encoding='utf-8')
for key in ['products','decisions','operationalTasks','documents','events','appointments','reports','messages','simpleProcesses']:
    c[key]=[]
c.pop('sourceSnapshot',None)
c['summary']='תיק בדיקה ריק להקמה מהתחלה. ללא קישור כתיבה לקומישנס.'
c['events']=[{'id':str(uuid.uuid4()),'at':stamp,'text':'עותק הבדיקה אופס לבקשת דוד; התיק האמיתי לא שונה'}]
db.execute('UPDATE office_clients SET payload=?,revision=revision+1 WHERE id=?',(json.dumps(c,ensure_ascii=False),cid))
assert dict(db.execute('SELECT id,payload FROM office_clients WHERE id<>?',(cid,)).fetchall())==others
db.commit()
saved=json.loads(db.execute('SELECT payload FROM office_clients WHERE id=?',(cid,)).fetchone()[0])
assert not saved['products'] and not saved['simpleProcesses'] and not saved['operationalTasks']
print(json.dumps({'client':saved['name'],'products':0,'processes':0,'tasks':0,'otherClientsUnchanged':True},ensure_ascii=False))
