"""Explicit creation conversation: one linked product, one request, no guessed outcome."""
import re
from app.services.simple_process import transition,reply,KINDS,PRODUCTS
from app.services.assistant_queries import matches_client

def start_request(body):
 m=re.fullmatch(r'(?:פתח|תפתח)(?: לי)?(?: תהליך)? (מינוי סוכן|הצטרפות|הפקה|תביעה|שינויים|שינוי)(?: ל(.+))?',body)
 if not m:return None
 return {'kind':{'מינוי סוכן':'appointment','הצטרפות':'production','הפקה':'production','תביעה':'claim','שינוי':'change','שינויים':'change'}[m[1]],'name':m[2]}

def creation_step(db,clients,state,body,event_id,client_id,request,ask):
 def options(message,items,stage):
  ask(message,items,stage)
  return state['lastReply']
 def choose():
  opts=state.get('options',[])
  if body.isdigit() and 1<=int(body)<=len(opts):return opts[int(body)-1]
  found=[x for x in opts if body==x['label'] or body in x.get('aliases',[])]
  return found[0] if len(found)==1 else None
 def ask_client():return options('לאיזה לקוח לפתוח '+KINDS[state['newKind']]+'?', [{'id':c['id'],'label':c['name'],'aliases':c.get('assistantAliases',[])} for c in clients],'create_client')
 def ask_product(c):
  if not c.get('products'):
   state.clear();return {'changed':False,'reply':'אין מוצרים בתיק. להצטרפות חדשה, הוסף גיוס בתיק; המוצר והטיפול ייפתחו יחד.'}
  return options('לאיזה מוצר לפתוח '+KINDS[state['newKind']]+'?', [{'id':p['id'],'label':(p.get('name') or p.get('category') or 'מוצר')+' · '+p.get('company','')+' · '+(p.get('policy') or 'ללא מספר פוליסה'),'aliases':[p.get('name',''),p.get('category','')]} for p in c['products']],'create_product')
 def create(c,x):
  kind=state['newKind']
  prior=next((p for p in c.get('simpleProcesses',[]) if p.get('productId')==x['id']),{})
  aliases={'ביטוח חיים':('חיים','ריסק רגיל'),'חיים':('חיים','ריסק רגיל'),'השתלמות':('פיננסים','קרן השתלמות')}
  category,product=aliases.get(x.get('category') or x.get('name'),('',''))
  for cat,ps in PRODUCTS.items():
   if x.get('category') in ps or x.get('name') in ps:category,product=cat,x.get('category') if x.get('category') in ps else x['name']
  category=prior.get('category') or category;product=prior.get('product') or product
  if kind=='production':
   existing=[p for p in c.get('simpleProcesses',[]) if p.get('productId')==x['id'] and p['kind']==kind and p['state'] not in ['done','stopped']]
   if existing:
    p=existing[0];state.clear();state.update(client=c['id'],process=p['id'],stage='action',options=[])
    return {'changed':False,'clientId':c['id'],'process':p,'reply':'ההצטרפות כבר פתוחה.\n'+reply(p)}
   state.clear();return {'changed':False,'reply':'להצטרפות חדשה יש להוסיף גיוס בתיק. כך הלקוח, המוצר והטיפול נשארים מקושרים בלי הזנה כפולה.'}
  service=state.get('newService','')
  existing=[p for p in c.get('simpleProcesses',[]) if p.get('productId')==x['id'] and p['kind']==kind and p['state'] not in ['done','stopped'] and (kind!='change' or p.get('serviceType','')==service)]
  if existing:
   p=existing[0];changed=False
  else:
   changed,p=transition(c,None,'create',{'kind':kind,'category':category,'product':product,'company':x.get('company',''),'productId':x['id'],'serviceType':service,'policy':x.get('policy','')},event_id)
   from app.api.routes.office import save
   if changed:save(db,c,c['revision'],'נפתח טיפול מקושר משיחת העוזר')
  state.clear();state.update(client=c['id'],process=p['id'],stage='action',options=[])
  return {'changed':changed,'clientId':c['id'],'process':p,'reply':('נפתח טיפול. ' if changed else 'כבר יש טיפול פתוח למוצר; פתחתי אותו עבורך. ')+reply(p)+'\n'+('חסר מספר פוליסה; אפשר להזין אותו בטיפול או לכתוב ״שלחתי לחברה״ והעוזר יבקש אותו.' if not x.get('policy') else 'אפשר להמשיך בכפתורי הדשבורד או לכתוב ״מה עכשיו״.')}
 if request:
  state.clear();state['newKind']=request['kind']
  found=[c for c in clients if matches_client(c,request['name'])] if request['name'] else [c for c in clients if c['id']==client_id]
  if len(found)!=1:return ask_client()
  state['client']=found[0]['id'];return ask_product(found[0])
 c=next((c for c in clients if c['id']==state.get('client')),None)
 stage=state.get('stage')
 if stage=='create_client':
  selected=choose()
  if not selected:return ask_client()
  state['client']=selected['id'];c=next(c for c in clients if c['id']==selected['id']);return ask_product(c)
 if not c:state.clear();return {'changed':False,'reply':'התיק לא נמצא; כתוב שוב את שם הלקוח.'}
 if stage=='create_product':
  selected=choose()
  if not selected:return ask_product(c)
  state['newProduct']=selected['id'];x=next(p for p in c['products'] if p['id']==selected['id'])
  if state['newKind']=='change':return options('איזה שינוי נדרש?', [{'id':'investment','label':'מסלול השקעה'},{'id':'fees','label':'דמי ניהול'},{'id':'other','label':'פרטים, מוטבים, כיסוי או אחר'}],'create_service')
  return create(c,x)
 if stage=='create_service':
  selected=choose()
  if not selected:return options('בחר את סוג השינוי.',state['options'],'create_service')
  state['newService']=selected['id'];return create(c,next(p for p in c['products'] if p['id']==state['newProduct']))
