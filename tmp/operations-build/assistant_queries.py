"""Explicit local assistant vocabulary; unknown or ambiguous instructions never write."""
import re
from app.services.simple_process import transition,reply,STATES,next_title

def matches_client(c,name):
 return name.strip().rstrip('?؟') in [c['name'].strip(),*c.get('assistantAliases',[])]

def handle(db,body,event_id,clients):
 from app.api.routes.office import save
 from sqlalchemy import text
 question=re.fullmatch(r'(?:מה המצב של|מה פתוח אצל|מה המשימה הבאה של|מה המוצרים של|מה העמלות של) (.+?)\??',body)
 if question:
  matches=[c for c in clients if matches_client(c,question[1])]
  if len(matches)!=1:return {'changed':False,'reply':'לא נמצא תיק יחיד בשם הזה. ציין את שם התיק המלא; לא שיניתי דבר.'}
  c=matches[0];lines=[c['name']]
  if body.startswith('מה העמלות'):
   rows=db.execute(text('SELECT s.* FROM sales s JOIN office_sale_links l ON l.sale_id=s.id WHERE l.client_id=:id'),{'id':c['id']}).mappings().all()
   for s in rows:lines.append(f"{s['company']} · {s['product']} · עמלת גיוס צפויה {s['total_comm']:,.2f} ₪")
   lines.append(f"סה״כ עמלת גיוס צפויה: {sum(s['total_comm'] for s in rows):,.2f} ₪. סכום צפוי אינו אישור שהתקבל תשלום.")
  elif body.startswith('מה המוצרים'):
   lines += [f"{p.get('company','')} · {p.get('name',p.get('category',''))}" for p in c.get('products',[])]
  else:
   processes=[p for p in c.get('simpleProcesses',[]) if p['state'] not in ['done','stopped']]
   lines += [f"#{p['id'][:8]} · {p.get('product') or 'פרטים טרם הושלמו'} · {STATES[p['state']]} · {next_title(p)} · מעקב {p.get('due') or 'לא נקבע'}" for p in processes]
   if not processes:lines.append('אין טיפולים פתוחים.')
  return {'changed':False,'clientId':c['id'],'reply':'\n'.join(lines)}
 match=re.search(r'#([0-9a-fA-F-]{8,36})(?:\s|$)',body)
 if not match:return None
 found=[(c,p) for c in clients for p in c.get('simpleProcesses',[]) if p['id'].startswith(match[1].lower())]
 if len(found)!=1:return {'changed':False,'reply':'לא נמצא טיפול יחיד. לא שיניתי דבר.'}
 c,p=found[0];message=(body[:match.start()]+body[match.end():]).strip()
 if message in ['מה המצב','מה השלב הבא','מה התזכורת']:
  return {'changed':False,'clientId':c['id'],'process':p,'reply':reply(p)}
 action=None;data={}
 reminder=re.fullmatch(r'תזכיר לי (\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}))?',message)
 reject=re.fullmatch(r'ריג[׳\']?קט (.+) עד (\d{4}-\d{2}-\d{2})',message)
 if reminder:action='remind';data={'due':reminder[1],'time':reminder[2] or ''}
 elif reject:action='reject';data={'detail':reject[1],'due':reject[2]}
 elif message.startswith('טופל ואומת:') and p['kind']!='production':action='result';data={'verified':True,'detail':message.split(':',1)[1].strip()}
 elif message=='בדקתי הפקה והכול תואם לסיכום':action='verify';data={'detailsCorrect':True,'termsCorrect':True,'executionCorrect':True}
 elif message.startswith('אימתתי ביטול:') and p['mode']=='replace' or message.startswith('אימתתי ניוד:') and p['mode']=='transfer':action='followup';data={'verified':True,'detail':message.split(':',1)[1].strip()}
 elif message=='עדכנתי את הלקוח וסיים':action='close';data={'customerUpdated':True}
 elif message.startswith('סגור ללא ביצוע:'):action='stop';data={'detail':message.split(':',1)[1].strip()}
 if not action:return None
 changed,p=transition(c,p['id'],action,data,event_id)
 if changed:save(db,c,c['revision'],'הוראה לעוזר: '+action)
 return {'changed':changed,'clientId':c['id'],'process':p,'reply':reply(p)}
