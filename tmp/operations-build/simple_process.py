"""Simple operations v1: explicit server transitions, stable tasks, no external side effects."""
import copy, uuid
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from app.services.health_join import biz, dated, today

KINDS = {'production':'הפקה','claim':'תביעה','change':'שינוי'}
STATES = {'new':'חדש','sent':'נשלח לחברה','reject':'ריג׳קט','handled':'טופל','produced':'הופק','followup':'ביטול / ניוד','done':'הושלם','stopped':'נסגר ללא ביצוע'}
PRODUCTS = {'בריאות':['בריאות','מחלות קשות'],'חיים':['ריסק רגיל','ריסק משכנתא'],'פנסיה':['פנסיה'],'פיננסים':['גמל','גמל להשקעה','קרן השתלמות']}

def need(ok, message):
    if not ok: raise HTTPException(400,message)

def short(data, key, required=True):
    value=str(data.get(key) or '').strip()
    need(len(value)<=1000 and (value or not required),'יש להשלים '+key)
    return value

def stamp(): return datetime.now(ZoneInfo('Asia/Jerusalem')).isoformat()

def next_title(p):
    return {'new':'הכנת הבקשה ושליחה לחברה','sent':'מעקב תשובת החברה','reject':'טיפול בריג׳קט: '+p.get('detail',''),'produced':'בדיקת הפקה מול הסיכום עם הלקוח','followup':'וידוא ביטול הפוליסה הקודמת' if p['mode']=='replace' else 'וידוא השלמת הניוד','handled':'עדכון הלקוח וסיום'}.get(p['state'],'')

def task_sync(c,p):
    tasks=c.setdefault('operationalTasks',[]);tid='simple:'+p['id']
    task=next((t for t in tasks if t['id']==tid),None)
    if not task:
        task={'id':tid,'source':'simple-process','processId':p['id'],'createdAt':stamp(),'owner':'דוד'};tasks.append(task)
    task.update(kind=next_title(p) or 'הטיפול הסתיים',due=p.get('due') or '',dueTime=p.get('dueTime',''),status='done' if p['state'] in ['done','stopped'] else 'open',note=p.get('detail',''),updatedAt=stamp())

def transition(client, process_id, action, data, event_id):
    need(isinstance(event_id,str) and 0<len(event_id)<=100,'חסר מזהה פעולה')
    c=copy.deepcopy(client);processes=c.setdefault('simpleProcesses',[])
    # Retries do not duplicate changes, including process creation.
    for existing in processes:
        event=next((e for e in existing['history'] if e['id']==event_id),None)
        if event:
            need(event['action']==action and (not process_id or existing['id']==process_id),'מזהה פעולה כבר שימש לפעולה אחרת')
            return False,existing
    if action=='create':
        kind=data.get('kind');need(kind in KINDS,'יש לבחור הפקה, תביעה או שינוי')
        category=data.get('category','');product=data.get('product','')
        need(not(category or product) or category in PRODUCTS and product in PRODUCTS[category],'יש לבחור קטגוריה ומוצר מתאימים')
        mode=data.get('mode','new');need(mode in (['new','replace'] if category in ['בריאות','חיים'] else ['new','transfer']),'מסלול אינו מתאים למוצר')
        need(kind=='production' or mode=='new','שחלוף וניוד שייכים להפקה')
        linked=data.get('productId') or None
        if linked:need(any(x['id']==linked for x in c.get('products',[])),'המוצר אינו שייך ללקוח')
        p={'id':str(uuid.uuid4()),'kind':kind,'category':category,'product':product,'company':short(data,'company',False),'mode':mode,'productId':linked,'state':'new','detail':short(data,'detail',False),'due':None,'history':[],'createdAt':stamp(),'verified':False}
        if data.get('due'):p['due']=dated(data['due'])
        p['modeConfirmed']=kind!='production' or 'mode' in data
        processes.append(p)
    else:
        p=next((p for p in processes if p['id']==process_id),None);need(p,'טיפול לא נמצא')
        state=p['state'];need(state not in ['done','stopped'],'הטיפול סגור')
        if action=='send':
            need(state in ['new','reject'],'ניתן לשלוח טיפול חדש או ריג׳קט שטופל')
            need(p.get('company') and p.get('category') in PRODUCTS and p.get('product') in PRODUCTS[p['category']],'יש להשלים חברה וסוג מוצר בדשבורד לפני שליחה')
            need(p.get('modeConfirmed',True),'יש לבחור חדש, שחלוף או ניוד לפני שליחה')
            due=biz(today()) if p['kind']=='production' else dated(data.get('due'))
            p.update(state='sent',due=due,detail='',sentAt=stamp(),verified=False)
        elif action=='details':
            need(state=='new','ניתן להשלים פרטים בשלב חדש בלבד')
            category=data.get('category');product=data.get('product');mode=data.get('mode','new')
            need(category in PRODUCTS and product in PRODUCTS[category],'יש לבחור מוצר מתאים')
            need(mode in (['new','replace'] if category in ['בריאות','חיים'] else ['new','transfer']) and (p['kind']=='production' or mode=='new'),'מסלול אינו מתאים')
            p.update(category=category,product=product,mode=mode,company=short(data,'company'),modeConfirmed=True)
        elif action=='reject':
            need(state in ['sent','produced'],'ריג׳קט מתקבל אחרי שליחה או בבדיקת הפקה')
            p.update(state='reject',detail=short(data,'detail'),due=dated(data.get('due')),verified=False)
        elif action=='wait':
            need(state=='sent','הטיפול אינו ממתין לחברה')
            p['due']=biz(today()) if p['kind']=='production' else dated(data.get('due'))
        elif action=='result':
            need(state=='sent','יש לשלוח לחברה לפני תיעוד תוצאה')
            if p['kind']=='production':p.update(state='produced',due=today())
            else:
                need(data.get('verified') is True,'יש לאמת שהתוצאה בוצעה בפועל')
                p.update(state='handled',due=today(),result=short(data,'detail'),verified=True)
        elif action=='verify':
            need(state=='produced','יש לתעד הפקה לפני בדיקה')
            need(all(data.get(k) is True for k in ['detailsCorrect','termsCorrect','executionCorrect']),'יש להשלים את צ׳קליסט הבדיקה מול מה שסוכם')
            p.update(verified=True,state='followup' if p['mode']!='new' else 'handled',due=today())
        elif action=='followup':
            need(state=='followup' and data.get('verified') is True,'יש לאמת ביטול או ניוד בפועל')
            p.update(state='handled',due=today(),followupResult=short(data,'detail'))
        elif action=='close':
            need(state=='handled' and p['verified'],'יש לאמת ביצוע והשלמת המעקב קודם')
            need(data.get('customerUpdated') is True,'יש לאשר שהלקוח עודכן בפועל')
            p.update(state='done',due=None,completedAt=stamp())
        elif action=='remind':
            p['due']=dated(data.get('due'));clock=data.get('time','')
            if clock:
                try:datetime.strptime(clock,'%H:%M')
                except ValueError:raise HTTPException(400,'שעה אינה תקינה')
            p['dueTime']=clock
        elif action=='stop':p.update(state='stopped',due=None,stopReason=short(data,'detail'))
        else:raise HTTPException(400,'פעולה לא נתמכת')
    if action!='remind':p['dueTime']=''
    p['history'].append({'id':event_id,'at':stamp(),'action':action,'state':p['state'],'detail':p.get('detail',''),'due':p.get('due')})
    task_sync(c,p);client.clear();client.update(c)
    return True,p

def digest(clients):
    day=today();out=[]
    for c in clients:
        for p in c.get('simpleProcesses',[]):
            if p['state'] not in ['done','stopped']:
                out.append({'clientId':c['id'],'clientName':c['name'],**p,'nextAction':next_title(p),'label':STATES[p['state']]})
    return {'day':day,'summaryTime':'19:00','timezone':'Asia/Jerusalem','open':len(out),'overdue':sum(bool(p.get('due')) and p['due']<day for p in out),'today':sum(p.get('due')==day for p in out),'undated':sum(not p.get('due') for p in out),'items':out,'delivery':'not-connected'}

def command(body):
    """Deliberately bounded commands. Uncertain/forwarded text never mutates records."""
    s=' '.join(body.strip().split())
    return {'נשלח':'send','שלחתי':'send','שלחתי לחברה':'send','שלחתי שוב':'send','עדיין ממתין':'wait','הופק':'result'}.get(s)

def reply(p):
    title=' · '.join(x for x in [f"טיפול #{p['id'][:8]}",KINDS[p['kind']],p.get('product'),p.get('company')] if x)
    return f"{title}\nסטטוס: {STATES[p['state']]}\n{next_title(p)}\nמעקב: {p.get('due') or 'לא נקבע'}"
