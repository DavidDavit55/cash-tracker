from datetime import datetime
from zoneinfo import ZoneInfo
from app.api.routes import office
from app.services.office_integration import schema
from app.services.simple_process import transition
from app.services.operations_reminders import plan

def test_19_only_stable_queue_and_close_cancels(db_session,monkeypatch):
    db=db_session;monkeypatch.setattr(office,'engine',db.get_bind());office.initialize();schema(db);db.commit()
    c=office.create(office.NewClient(name='דמה תזמונים'),db);rev=c['revision']
    _,p=transition(c,None,'create',{'kind':'claim'},'create')
    transition(c,p['id'],'remind',{'due':'2026-10-28','time':'14:00'},'remind');office.save(db,c,rev,'בדיקה')
    at=lambda h:datetime(2026,10,28,h,0,tzinfo=ZoneInfo('Asia/Jerusalem'))
    assert not plan(db,at(9))['rows']
    r=plan(db,at(14));assert len(r['rows'])==1 and r['rows'][0]['kind']=='reminder'
    assert len(plan(db,at(15))['rows'])==1
    r=plan(db,at(19));assert len(r['rows'])==2
    assert len(plan(db,at(20))['rows'])==2
    c=office.record(db,c['id']);rev=c['revision'];transition(c,p['id'],'stop',{'detail':'דמה — סגירה'},'close');office.save(db,c,rev,'בדיקה')
    r=plan(db,at(21));assert next(x for x in r['rows'] if x['kind']=='reminder')['state']=='superseded'
    assert next(x for x in r['rows'] if x['kind']=='daily')['payload']['open']==0
    assert r['delivery']=='disabled' and not r['scheduled']

def test_date_only_does_not_invent_alarm_and_timezone(db_session,monkeypatch):
    db=db_session;monkeypatch.setattr(office,'engine',db.get_bind());office.initialize();schema(db);db.commit()
    c=office.create(office.NewClient(name='דמה ללא שעה'),db);rev=c['revision']
    transition(c,None,'create',{'kind':'change','due':'2026-10-28'},'create');office.save(db,c,rev,'בדיקה')
    # October 28 is Israel winter time: 17 UTC is 19 local.
    assert not plan(db,datetime(2026,10,28,16,59,tzinfo=ZoneInfo('UTC')))['rows']
    rows=plan(db,datetime(2026,10,28,17,0,tzinfo=ZoneInfo('UTC')))['rows']
    assert len(rows)==1 and rows[0]['kind']=='daily'
