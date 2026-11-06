"""Opt-in recruitment bridge. Existing historical workflows are never migrated implicitly."""
import copy
from app.services.simple_process import transition

def connect(c,draft):
 sale_id=draft['sourceSaleId']
 existing=next((p for p in c.get('simpleProcesses',[]) if p.get('sourceSaleId')==sale_id),None)
 if existing:return existing
 sale=draft['officeFlow']['sourceSnapshot'];raw=sale.get('product') or sale['category']
 aliases={'ביטוח חיים':('חיים','ריסק רגיל'),'חיים':('חיים','ריסק רגיל'),'ריסק':('חיים','ריסק רגיל'),'חיים משכנתא':('חיים','ריסק משכנתא'),'בריאות':('בריאות','בריאות'),'מחלות קשות':('בריאות','מחלות קשות'),'פנסיה':('פנסיה','פנסיה'),'קרן השתלמות':('פיננסים','קרן השתלמות'),'השתלמות':('פיננסים','קרן השתלמות'),'גמל':('פיננסים','גמל'),'גמל להשקעה':('פיננסים','גמל להשקעה')}
 category,product=aliases.get(raw,('',''))
 _,p=transition(c,None,'create',{'kind':'production','category':category,'product':product,'company':sale['company'],'productId':draft['productId']},'recruitment:'+str(sale_id))
 p.update(sourceSaleId=sale_id,agreed=copy.deepcopy(draft['officeFlow'].get('agreed',{})),recruitmentSnapshot=copy.deepcopy(sale))
 c.setdefault('legacyDraftArchive',[]).append(copy.deepcopy(draft))
 c['decisions']=[d for d in c['decisions'] if d['id']!=draft['id']]
 c['operationalTasks']=[t for t in c['operationalTasks'] if not(t.get('source')=='recruitment' and t.get('saleId')==sale_id)]
 return p
