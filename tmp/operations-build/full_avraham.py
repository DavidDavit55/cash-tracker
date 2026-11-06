import os,sys,json,copy,sqlite3
from pathlib import Path
root=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations');sys.path.insert(0,str(root/'backend'))
path=(Path(__file__).parent/'operations-demo.sqlite').resolve()
assert path.name=='operations-demo.sqlite'
src=sqlite3.connect(path);dst=sqlite3.connect(path.with_name('before-full-avraham.sqlite'));src.backup(dst);src.close();dst.close()
os.environ['DATABASE_URL']='sqlite:///'+path.as_posix();os.environ['OPERATIONS_WHATSAPP_ENABLED']='0'
from app.db.session import SessionLocal
from app.services.office_integration import rows,persist
from app.services.sales import create_sale
from app.services.simple_process import transition
cid='02c955f2-0b76-46bb-90b5-626d1843abc9'
with SessionLocal() as db:
 c=next(x for x in rows(db) if x['id']==cid);assert c['name']=='אברהם לוטה — עותק בדיקה';before=copy.deepcopy(c)
 c['assistantAliases']=['אברהם לוטה'];c['simpleOperations']=True
 persist(db,c,before,'הוגדר כינוי לעוזר עבור עותק הבדיקה בלבד');db.commit()
 for company,product,category,amount,key in [('הראל','קרן השתלמות','פיננסים',62000,'hishtalmut'),('מגדל','בריאות','סיכונים',261,'health')]:
  create_sale(db,{'office_client_id':cid,'client_name':c['name'],'company':company,'product':product,'category':category,'base_amount':amount,'sale_date':'2026-10-28','nifraim_factor':1,'request_id':'full-demo-avraham-'+key})
 c=next(x for x in rows(db) if x['id']==cid);before=copy.deepcopy(c)
 for kind,category,product,company,needle in [('claim','בריאות','בריאות','מגדל','בריאות'),('change','חיים','ריסק רגיל','איילון','ביטוח חיים')]:
  linked=next(p for p in c['products'] if p['name']==needle)
  transition(c,None,'create',{'kind':kind,'category':category,'product':product,'company':company,'productId':linked['id'],'detail':'תרחיש דמה בלבד לבדיקת המערכת; לא בקשת לקוח אמיתית'},'full-demo-'+kind)
 persist(db,c,before,'הוכנו תביעת דמה ושינוי דמה לבדיקת הוראות העוזר');db.commit()
 print('Local demo:',len(c['products']),'products,',len(c['simpleProcesses']),'processes')
