import copy,json
from sqlalchemy import text
from app.api.routes import office
from app.services.office_integration import schema
from app.services.simple_process import transition
from app.services.operations_bot import respond

def test_assistant_questions_commands_and_retry(db_session,monkeypatch):
 db=db_session;monkeypatch.setattr(office,'engine',db.get_bind());office.initialize();schema(db);db.commit()
 c=office.create(office.NewClient(name='אברהם לוטה — עותק בדיקה'),db);c['assistantAliases']=['אברהם לוטה']
 _,p=transition(c,None,'create',{'kind':'claim','category':'בריאות','product':'בריאות','company':'מגדל'},'seed')
 office.save(db,c,c['revision'],'test');pid=p['id'][:8]
 assert 'חדש' in respond(db,'מה המצב של אברהם לוטה','q')['reply']
 assert not respond(db,'מה העמלות של אברהם לוטה','q2')['changed']
 before=office.record(db,c['id'])['revision']
 assert not respond(db,'אולי זה טופל','unknown')['changed'];assert office.record(db,c['id'])['revision']==before
 for idx,cmd in enumerate(['נשלח 2026-10-29','ריג׳קט חסר פרט עד 2026-10-30','נשלח 2026-10-30','תזכיר לי 2026-10-30 14:00','טופל ואומת: התקבל תשלום בדיקה','עדכנתי את הלקוח וסיים']):
  body='#'+pid+' '+cmd;result=respond(db,body,'cmd'+str(idx));assert result['changed']
  assert not respond(db,body,'cmd'+str(idx))['changed']
 assert result['process']['state']=='done'
 saved=office.record(db,c['id']);assert len(saved['operationalTasks'])==1 and saved['operationalTasks'][0]['status']=='done'
