"""Persistent clarification, scoped to one browser conversation; no guessed mutations."""
import json,re
from sqlalchemy import text
from fastapi import HTTPException
from app.services.simple_process import KINDS,STATES,reply,transition
from app.services.operations_bot import clients,respond
from app.services.assistant_queries import matches_client

def chat(db,body,event_id,conversation_id,client_id=None,process_id=None):
 db.execute(text('CREATE TABLE IF NOT EXISTS office_assistant_dialog (id TEXT PRIMARY KEY,payload TEXT NOT NULL)'))
 row=db.execute(text('SELECT payload FROM office_assistant_dialog WHERE id=:id'),{'id':conversation_id}).scalar()
 state=json.loads(row) if row else {}
 if state.get('lastEvent')==event_id:return state['lastReply']
 all_clients=clients(db);body=' '.join(body.strip().split())
 def finish(answer):
  state.update(lastEvent=event_id,lastReply=answer)
  db.execute(text('INSERT INTO office_assistant_dialog VALUES(:id,:p) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload'),{'id':conversation_id,'p':json.dumps(state,ensure_ascii=False)});db.commit();return answer
 def ask(message,options,stage):
  state['stage']=stage;state['options']=options
  return finish({'changed':False,'reply':message+'\n'+'\n'.join(f"{i+1}. {o['label']}" for i,o in enumerate(options)),'choices':[o['label'] for o in options]})
 def choose(options):
  if body.isdigit() and 1<=int(body)<=len(options):return options[int(body)-1]
  matches=[o for o in options if body==o['label'] or body in o.get('aliases',[])]
  return matches[0] if len(matches)==1 else None
 def ask_client():return ask('על איזה לקוח מדובר? אפשר לבחור או לכתוב את השם.',[{'id':c['id'],'label':c['name'],'aliases':c.get('assistantAliases',[])} for c in all_clients],'client')
 def current():
  c=next((c for c in all_clients if c['id']==state.get('client')),None)
  p=next((p for p in (c or {}).get('simpleProcesses',[]) if p['id']==state.get('process')),None)
  return c,p
 def ask_product(c):
  opts=[]
  for p in c.get('simpleProcesses',[]):
   key=p.get('productId') or p.get('company','')+'|'+p.get('product','')
   if any(o['id']==key for o in opts):continue
   opts.append({'id':key,'label':(p.get('product') or 'מוצר שטרם הושלם')+' · '+p.get('company',''),'aliases':[p.get('product','')]})
  return ask('על איזה מוצר אצל '+c['name']+' מדובר?',opts,'product') if opts else finish({'changed':False,'reply':'אין בתיק טיפול קיים. אפשר לכתוב ״פתח הפקה ל״ ואחריו שם הלקוח. כתוב ״התחל מחדש״ כדי לצאת מהבירור.'})
 def ask_action(p):
  opts=[{'id':'query','label':'מה המצב ומה השלב הבא?'}]
  if p['state'] in ['new','reject']:opts.append({'id':'send','label':'שלחתי לחברה','aliases':['נשלח','נשלח לחברה','שלחתי את המסמכים','שלחתי מסמכים לחברה','השלמתי ושלחתי שוב']})
  if p['state']=='sent':opts += [{'id':'wait','label':'עדיין ממתין לתשובה','aliases':['עדיין ממתין','לא קיבלתי תשובה']},{'id':'result','label':'הופק' if p['kind']=='production' else 'טופל'}]
  if p['state'] in ['sent','produced']:opts.append({'id':'reject','label':'יש ריג׳קט או השלמה','aliases':['ריג׳קט','ריגקט','צריך השלמה']})
  if p['state']=='produced':opts.append({'id':'verify','label':'בדקתי הפקה והכול תואם לסיכום'})
  if p['state']=='followup':opts.append({'id':'followup','label':'אימתתי ביטול' if p['mode']=='replace' else 'אימתתי ניוד'})
  if p['state']=='handled':opts.append({'id':'close','label':'עדכנתי את הלקוח וסיים'})
  if p['state'] not in ['done','stopped']:opts.append({'id':'remind','label':'קבע לי תזכורת','aliases':['תזכיר לי','תזכורת']})
  return ask(f"{KINDS[p['kind']]} · {p.get('product','')} · {p.get('company','')} — {STATES[p['state']]}. לאן להתקדם?",opts,'action')
 def execute(c,p,action,data):
  from app.api.routes.office import save
  try:
   changed,p=transition(c,p['id'],action,data,event_id)
   if changed:save(db,c,c['revision'],'עדכון בשיחת העוזר: '+action)
  except HTTPException as e:
   return finish({'changed':False,'reply':str(e.detail)+' לא בוצע עדכון. אפשר לכתוב ״התחל מחדש״.'})
  state['stage']='action';state['options']=[]
  result={'changed':changed,'clientId':c['id'],'process':p,'reply':reply(p)+'\nאפשר לכתוב ״מה עכשיו״ להמשך או ״לקוח אחר״.'}
  return finish(result)
 if body in ['התחל מחדש','לקוח אחר','עזוב','בטל שיחה']:
  state.clear();return ask_client()
 stage=state.get('stage')
 if not stage:
  result=respond(db,body,event_id,client_id,process_id)
  if result.get('process'):
   state.update(client=result['clientId'],process=result['process']['id'],stage='action',options=[])
  if result.get('changed') or result.get('process') or result.get('clientId') or body in ['סיכום','סיכום יומי','מה פתוח','מה יש לי היום']:return finish(result)
  state['original']=body;return ask_client()
 c,p=current()
 if stage=='client':
  selected=choose(state['options'])
  if not selected:return ask_client()
  state['client']=selected['id'];c,p=current();return ask_product(c)
 if not c:state.clear();return ask_client()
 if stage=='product':
  selected=choose(state['options'])
  if not selected:return ask_product(c)
  found=[p for p in c.get('simpleProcesses',[]) if (p.get('productId') or p.get('company','')+'|'+p.get('product',''))==selected['id']]
  if len(found)>1:return ask('יש יותר מטיפול אחד למוצר. לאיזה טיפול התכוונת?',[{'id':p['id'],'label':KINDS[p['kind']]+' · '+STATES[p['state']],'aliases':[KINDS[p['kind']]]} for p in found],'process')
  state['process']=found[0]['id'];return ask_action(found[0])
 if stage=='process':
  selected=choose(state['options'])
  if not selected:return ask('בחר את סוג הטיפול.',state['options'],'process')
  state['process']=selected['id'];c,p=current();return ask_action(p)
 if not p:return ask_product(c)
 if stage=='action':
  selected=choose(state.get('options',[]))
  if not selected:return ask_action(p)
  action=selected['id'];state['action']=action
  if action=='query':return finish({'changed':False,'reply':reply(p),'clientId':c['id'],'process':p})
  if action=='send' and p.get('modeConfirmed') is False:
   return ask('זו הפקה חדשה או החלפת מוצר קיים?',[{'id':'new','label':'חדש'},{'id':'replace' if p['category'] in ['בריאות','חיים'] else 'transfer','label':'שחלוף' if p['category'] in ['בריאות','חיים'] else 'ניוד'}],'mode')
  if action in ['reject','followup'] or action=='result' and p['kind']!='production':
   state['stage']='detail';return finish({'changed':False,'reply':'מה חסר או צריך לתקן?' if action=='reject' else 'מה בוצע ואומת בפועל? כתוב תיאור קצר.'})
  if action=='remind' or action in ['send','wait'] and p['kind']!='production':
   state['stage']='date';return finish({'changed':False,'reply':'לאיזה תאריך לקבוע מעקב? אפשר לכתוב 30/10/2026 או 2026-10-30, ולהוסיף שעה כמו 14:00.'})
  if action in ['verify','close']:
   return ask('לאשר שההפקה נבדקה מול הסיכום והכול תואם?' if action=='verify' else 'לאשר שהלקוח עודכן בפועל ולסיים?',[{'id':'yes','label':'כן'},{'id':'no','label':'לא'}],'confirm')
  return execute(c,p,action,{})
 if stage=='mode':
  selected=choose(state['options'])
  if not selected:return ask('בחר חדש, שחלוף או ניוד מתוך האפשרויות.',state['options'],'mode')
  return execute(c,p,'details',{'category':p['category'],'product':p['product'],'company':p['company'],'mode':selected['id']})
 if stage=='detail':
  if not body:return finish({'changed':False,'reply':'כתוב תיאור קצר.'})
  state['detail']=body
  if state['action']=='reject':state['stage']='date';return finish({'changed':False,'reply':'מתי להזכיר לך לטפל בהשלמה? כתוב תאריך, למשל 30/10/2026.'})
  return ask('לאשר שהתוצאה שתיארת אומתה בפועל?',[{'id':'yes','label':'כן'},{'id':'no','label':'לא'}],'confirm')
 if stage=='confirm':
  selected=choose(state['options'])
  if not selected:return ask('בחר כן או לא.',state['options'],'confirm')
  if selected['id']=='no':return ask_action(p)
  data={'verified':True,'customerUpdated':True,'detailsCorrect':True,'termsCorrect':True,'executionCorrect':True,'detail':state.get('detail','')}
  return execute(c,p,state['action'],data)
 if stage=='date':
  match=re.fullmatch(r'(\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{4})(?: (\d{2}:\d{2}))?',body)
  if not match:return finish({'changed':False,'reply':'לא זיהיתי תאריך. כתוב יום/חודש/שנה, למשל 30/10/2026. לא שיניתי את המעקב.'})
  due=match[1]
  if '/' in due:
   d,m,y=due.split('/');due=f'{y}-{int(m):02}-{int(d):02}'
  return execute(c,p,state['action'],{'due':due,'time':match[2] or '', 'detail':state.get('detail','')})
 return ask_client()
