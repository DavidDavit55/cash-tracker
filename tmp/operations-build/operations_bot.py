"""Small deterministic personal assistant. Never guesses a customer or outcome."""
import re
from fastapi import HTTPException
from sqlalchemy import text
from app.api.routes.office import record,save
from app.services.simple_process import transition,command,reply,digest

def clients(db):
    return [c for row in db.execute(text('SELECT id FROM office_clients')) if not (c:=record(db,row[0])).get('archivedTo')]

def respond(db,body,event_id):
    body=' '.join(body.strip().split())
    all_clients=clients(db)
    if body in ['סיכום','סיכום יומי','מה פתוח','מה יש לי היום']:
        d=digest(all_clients)
        lines=[f"פתוחים: {d['open']} · להיום: {d['today']} · באיחור: {d['overdue']}"]
        lines += [f"#{p['id'][:8]} {p['clientName']} · {p['label']} · {p['nextAction']} · {p.get('due') or 'טרם נקבע מועד'}" for p in d['items'][:15]]
        return {'reply':'\n'.join(lines),'changed':False}
    start=re.fullmatch(r'(?:פתח|תפתח)(?: לי)?(?: תהליך)? (הפקה|תביעה|שינוי|שינויים) ל(.+)',body)
    if start:
        matches=[c for c in all_clients if c['name'].strip()==start[2].strip()]
        if len(matches)!=1:return {'reply':'לא מצאתי לקוח יחיד בשם הזה. כתוב את השם המלא כפי שמופיע בדשבורד. לא נפתח טיפול.','changed':False}
        c=matches[0];kind={'הפקה':'production','תביעה':'claim','שינוי':'change','שינויים':'change'}[start[1]]
        existing=[p for p in c.get('simpleProcesses',[]) if p['kind']==kind and p['state'] not in ['done','stopped']]
        if existing:
            if len(existing)==1:return {'reply':'כבר יש טיפול פתוח מסוג זה. לא פתחתי כפילות.\n'+reply(existing[0]),'changed':False,'process':existing[0],'clientId':c['id']}
            return {'reply':'קיימים כמה טיפולים פתוחים מסוג זה. בחר את מספר הטיפול בדשבורד; לא פתחתי נוסף.','changed':False}
        changed,p=transition(c,None,'create',{'kind':kind},event_id)
        if changed:save(db,c,c['revision'],'פתיחת טיפול מהבוט')
        return {'reply':reply(p)+'\nהטיפול נפתח כחדש. לפני שליחה יש להשלים חברה, מוצר ומסלול בדשבורד.','changed':changed,'process':p,'clientId':c['id']}
    match=re.search(r'#([0-9a-fA-F-]{8,36})(?:\s|$)',body)
    if match:
        found=[(c,p) for c in all_clients for p in c.get('simpleProcesses',[]) if p['id'].startswith(match[1].lower())]
        if len(found)!=1:return {'reply':'לא נמצא טיפול יחיד עם המספר הזה. לא שיניתי דבר.','changed':False}
        c,p=found[0];message=(body[:match.start()]+body[match.end():]).strip();values={}
        due=re.search(r'\s+(\d{4}-\d{2}-\d{2})$',message)
        if due:values['due']=due[1];message=message[:due.start()].strip()
        action=command(message)
        if action=='result' and p['kind']!='production':return {'reply':'תביעה או שינוי דורשים אימות תוצאה בדשבורד. לא שיניתי דבר.','changed':False}
        if action:
            changed,p=transition(c,p['id'],action,values,event_id)
            if changed:save(db,c,c['revision'],'עדכון מהבוט: '+action)
            return {'reply':reply(p),'changed':changed,'process':p,'clientId':c['id']}
    return {'reply':'אפשר לכתוב: פתח תביעה ל[שם הלקוח], פתח הפקה ל[שם הלקוח], סיכום, או #[מספר טיפול] נשלח. בתביעה ושינוי הוסף מועד מעקב YYYY-MM-DD. הודעות חופשיות או מועברות עדיין דורשות בדיקה בדשבורד. לא שיניתי דבר.','changed':False}
