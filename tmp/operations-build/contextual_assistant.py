"""Resolve bounded everyday phrases against an explicit on-screen context."""
import re
from app.services.simple_process import transition,reply,KINDS

def resolve(db,body,event_id,clients,client_id,process_id):
 if not client_id or '#' in body:return None
 c=next((c for c in clients if c['id']==client_id),None)
 if not c:return {'changed':False,'reply':'התיק הפתוח לא נמצא. רענן את המסך; לא שיניתי דבר.'}
 patterns=[('send',r'(?:נשלח(?:ו)?(?: מסמכים)?(?: לחברה)?|שלחתי(?: את)?(?: המסמכים| מסמכים)?(?: לחברה)?)'),('result',r'הופק'),('wait',r'עדיין ממתין'),('query',r'מה המצב(?: של)?')]
 action=None;subject=''
 for candidate,pattern in patterns:
  match=re.fullmatch(r'(.+?)\s+'+pattern,body) or re.fullmatch(pattern+r'\s+(.+)',body)
  if match:action=candidate;subject=match[1].strip();break
 mode=re.fullmatch(r'(.+?)\s+(חדש|שחלוף|ניוד)',body)
 if mode:action='mode';subject=mode[1].strip()
 if not action:return None
 matches=[p for p in c.get('simpleProcesses',[]) if p.get('product') and (subject==p['product'] or subject==p.get('company','')+' '+p['product'] or subject==KINDS[p['kind']]+' '+p['product'])]
 selected=next((p for p in matches if p['id']==process_id),None)
 if selected:matches=[selected]
 if len(matches)!=1:
  return {'changed':False,'reply':'יש כמה טיפולים למוצר הזה. בחר בטבלה את ההפקה, התביעה או השינוי שאליהם התכוונת.' if matches else 'לא מצאתי מוצר כזה בתיק הפתוח. כתוב את שם המוצר כפי שמופיע בטבלה. לא שיניתי דבר.'}
 p=matches[0]
 if action=='query':return {'changed':False,'clientId':c['id'],'process':p,'reply':reply(p)}
 if action=='mode':
  if p['state']!='new':return {'changed':False,'reply':'הטיפול כבר התקדם; שינוי סוג ההפקה דורש בדיקה. לא שיניתי דבר.'}
  from app.api.routes.office import save
  changed,p=transition(c,p['id'],'details',{'category':p['category'],'product':p['product'],'company':p['company'],'mode':{'חדש':'new','שחלוף':'replace','ניוד':'transfer'}[mode[2]]},event_id)
  if changed:save(db,c,c['revision'],'הושלם סוג ההפקה בהוראה לעוזר')
  return {'changed':changed,'clientId':c['id'],'process':p,'reply':'נשמר סוג ההפקה. כעת אפשר לכתוב: '+p['product']+' נשלח לחברה.'}
 if action=='send' and p.get('modeConfirmed') is False:
  return {'changed':False,'clientId':c['id'],'process':p,'reply':'הבנתי: '+p['product']+' ב'+p['company']+' בתיק '+c['name']+'. לפני עדכון השליחה חסר רק סוג ההפקה: חדש או '+('שחלוף' if p['category'] in ['חיים','בריאות'] else 'ניוד')+'? כתוב למשל: '+p['product']+' חדש. השליחה עדיין לא סומנה.'}
 if action=='send' and p['kind']!='production':return {'changed':False,'reply':'לאיזה תאריך לקבוע מעקב? בטיפול הזה יש לבחור מועד לפני עדכון השליחה.'}
 return {'command':'#'+p['id']+' '+{'send':'נשלח','result':'הופק','wait':'עדיין ממתין'}[action]}
