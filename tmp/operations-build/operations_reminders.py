"""Durable local reminder outbox. Planning only; never sends to any provider.

One daily digest at/after 19 Israel; reminders require an explicit date/time.
No morning digest and no invented time for date-only tasks. External worker
must revalidate each pending item against current process state before delivery.
"""
import json,hashlib
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import text
from app.services.operations_bot import clients
from app.services.simple_process import next_title,STATES

def schema(db):
    db.execute(text('CREATE TABLE IF NOT EXISTS office_ops_outbox (key TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL, planned_at TEXT NOT NULL)'))

def plan(db,at=None):
    at=at or datetime.now(ZoneInfo('Asia/Jerusalem'))
    if at.tzinfo is None:raise ValueError('Timezone required')
    local=at.astimezone(ZoneInfo('Asia/Jerusalem'));day=local.date().isoformat()
    schema(db);candidates={};open_items=[]
    for c in clients(db):
        for p in c.get('simpleProcesses',[]):
            if p['state'] in ['done','stopped']:continue
            item={'clientId':c['id'],'processId':p['id'],'clientName':c['name'],'state':p['state'],'nextAction':next_title(p),'due':p.get('due'),'time':p.get('dueTime','')}
            open_items.append(item)
            if not item['due'] or not item['time']:continue
            when=datetime.fromisoformat(item['due']+'T'+item['time']).replace(tzinfo=ZoneInfo('Asia/Jerusalem'))
            if when>local:continue
            identity=f"{p['id']}:{item['due']}:{item['time']}"
            key='reminder:'+hashlib.sha256(identity.encode()).hexdigest()
            candidates[key]=('reminder',item)
    if local.hour>=19:
        candidates['daily:'+day]=('daily',{'date':day,'time':'19:00','timezone':'Asia/Jerusalem','open':len(open_items),'items':open_items})
    # Close/reschedule invalidates queued reminders, never deletes audit history.
    for row in db.execute(text("SELECT key,kind FROM office_ops_outbox WHERE state='pending'")):
        if row[0] not in candidates:
            db.execute(text("UPDATE office_ops_outbox SET state='superseded' WHERE key=:key"),{'key':row[0]})
    for key,(kind,payload) in candidates.items():
        db.execute(text("INSERT INTO office_ops_outbox VALUES(:key,:kind,:payload,'pending',:at) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload WHERE office_ops_outbox.state='pending'"),{'key':key,'kind':kind,'payload':json.dumps(payload,ensure_ascii=False),'at':local.isoformat()})
    db.commit()
    rows=[{'key':r[0],'kind':r[1],'payload':json.loads(r[2]),'state':r[3]} for r in db.execute(text('SELECT key,kind,payload,state FROM office_ops_outbox'))]
    return {'delivery':'disabled','scheduled':False,'timezone':'Asia/Jerusalem','rows':rows}
