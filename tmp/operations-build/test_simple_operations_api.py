import json,uuid
import pytest
from fastapi import HTTPException
from sqlalchemy import text
from app.api.routes import office,simple_operations as api
from app.services.office_integration import schema
from app.services.simple_process import today

def setup(db,monkeypatch):
    monkeypatch.setattr(office,'engine',db.get_bind());office.initialize();schema(db);db.commit()
    return office.create(office.NewClient(name='דמה #01 בדיקת שמירה'),db)

def test_persistence_retry_revision_and_summary(db_session,monkeypatch):
    db=db_session;c=setup(db,monkeypatch)
    request=api.Change(clientId=c['id'],revision=c['revision'],eventId='create-1',action='create',values={'kind':'production','category':'בריאות','product':'בריאות','company':'חברת דמה','mode':'replace'})
    r=api.mutate(request,db);p=r['process'];rev=r['client']['revision']
    assert api.mutate(request,db)['duplicate'] is True
    db.expire_all();saved=office.record(db,c['id'])
    assert len(saved['simpleProcesses'])==len(saved['operationalTasks'])==1 and saved['revision']==rev
    stale=api.Change(clientId=c['id'],revision=rev-1,processId=p['id'],eventId='send-stale',action='send')
    with pytest.raises(HTTPException) as ex:api.mutate(stale,db)
    assert ex.value.status_code==409
    assert office.record(db,c['id'])['simpleProcesses'][0]['state']=='new'
    msg=api.Message(clientId=c['id'],revision=rev,processId=p['id'],eventId='send-good',action='message',body='נשלח')
    r=api.simulate(msg,db);assert r['process']['state']=='sent'
    msg.body='מישהו אמר שאולי הופק';msg.eventId='unknown'
    assert api.simulate(msg,db)['clarification']
    assert office.record(db,c['id'])['revision']==rev+1
    assert api.overview(db)['open']==1
