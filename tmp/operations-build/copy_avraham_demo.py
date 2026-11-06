"""Copy only observed client/product fields into the isolated local pilot DB."""
from pathlib import Path
import sqlite3,json,uuid,datetime
target=Path(__file__).parent/'operations-demo.sqlite'
assert target.name=='operations-demo.sqlite' and target.exists()
db=sqlite3.connect(target)
name='אברהם לוטה — עותק בדיקה'
existing=[json.loads(r[0]) for r in db.execute('select payload from office_clients') if json.loads(r[0]).get('name')==name]
if existing:
    print('Existing isolated copy:',existing[0]['id']);raise SystemExit
now=datetime.datetime.now(datetime.timezone.utc).isoformat();cid=str(uuid.uuid4())
products=[]
for company,product,category,amount,kind in [('הראל','קרן השתלמות','פיננסים',62000,'managedCapital'),('איילון','ביטוח חיים','חיים',111,'premium'),('מגדל','בריאות','בריאות',261,'premium')]:
    products.append({'id':str(uuid.uuid4()),'company':company,'name':product,'category':category,'policy':'','source':'isolated-commissions-snapshot','asOf':'2026-10-28','status':'בהפקה','coverage':[],kind:amount,'testOnly':True})
c={'id':cid,'name':name,'phone':'','email':'','identity':'','created':now,'source':'isolated-test-copy','isTest':True,'testOnly':True,'products':products,'decisions':[],'operationalTasks':[],'documents':[],'events':[{'id':str(uuid.uuid4()),'at':now,'text':'עותק בדיקה מבודד לפי שלושה מוצרים שנצפו בקומישנס; אין קישור כתיבה למקור'}],'appointments':[],'reports':[],'messages':[],'stage':'לקוח בדיקה','summary':'עותק מבודד של אברהם לוטה. שלושת המוצרים נצפו בהפקה. לא הועתקו פרטי קשר או תעודת זהות. אין להסיק חדש/שחלוף/ניוד ללא בחירה.','sourceSnapshot':{'observedAt':now,'url':'https://commissions.davit-fin.co.il/client','originalName':'אברהם לוטה','readOnly':True},'simpleProcesses':[]}
db.execute('insert into office_clients(id,revision,payload,commission_id) values(?,1,?,NULL)',(cid,json.dumps(c,ensure_ascii=False)));db.commit()
saved=json.loads(db.execute('select payload from office_clients where id=?',(cid,)).fetchone()[0]);assert len(saved['products'])==3 and not saved['phone']
print('Created isolated copy:',cid,'products:',len(saved['products']))
