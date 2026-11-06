import pytest
from fastapi import HTTPException
from app.api.routes import office
from app.services.office_integration import schema
from app.services.operations_bot import respond
from app.services.simple_process import transition

def test_bot_creates_minimal_draft_retries_and_does_not_guess(db_session,monkeypatch):
    db=db_session;monkeypatch.setattr(office,'engine',db.get_bind());office.initialize();schema(db);db.commit()
    c=office.create(office.NewClient(name='לקוח דמה לבוט'),db)
    r=respond(db,'פתח הפקה ללקוח דמה לבוט','one');pid=r['process']['id']
    assert r['changed'] and r['process']['state']=='new'
    assert r['process']['company']=='' and r['process']['product']=='' and not r['process']['modeConfirmed']
    assert not respond(db,'פתח הפקה ללקוח דמה לבוט','one')['changed']
    assert not respond(db,'פתח הפקה ללקוח דמה לבוט','different-message')['changed']
    assert not respond(db,'פתח הפקה ללקוח','no-match')['changed']
    with pytest.raises(HTTPException):respond(db,f'#{pid[:8]} נשלח','early')
    c=office.record(db,c['id']);rev=c['revision']
    transition(c,pid,'details',{'category':'חיים','product':'ריסק רגיל','company':'חברת דמה','mode':'new'},'details')
    office.save(db,c,rev,'בדיקה')
    assert respond(db,f'#{pid[:8]} נשלח','sent')['process']['state']=='sent'
    assert not respond(db,f'#{pid[:8]} נשלח','sent')['changed']
    assert 'פתוחים: 1' in respond(db,'סיכום','summary')['reply']
    assert len(office.record(db,c['id'])['operationalTasks'])==1
    saved=office.record(db,c['id'])
    with pytest.raises(HTTPException) as ex:
        office.action(c['id'],office.Mutation(revision=saved['revision'],kind='task-status',data={'id':'simple:'+pid,'status':'done','result':'אסור לעקוף תהליך'}),db)
    assert ex.value.status_code==400
    assert office.record(db,c['id'])['operationalTasks'][0]['status']=='open'

def test_claim_requires_explicit_due_and_manual_result(db_session,monkeypatch):
    db=db_session;monkeypatch.setattr(office,'engine',db.get_bind());office.initialize();schema(db);db.commit()
    c=office.create(office.NewClient(name='תביעת דמה'),db)
    p=respond(db,'פתח תביעה לתביעת דמה','claim')['process'];c=office.record(db,c['id']);rev=c['revision']
    transition(c,p['id'],'details',{'category':'בריאות','product':'בריאות','company':'דמה'},'details');office.save(db,c,rev,'בדיקה')
    with pytest.raises(HTTPException):respond(db,f"#{p['id'][:8]} נשלח",'missing-date')
    result=respond(db,f"#{p['id'][:8]} נשלח 2026-11-01",'send')
    assert result['process']['due']=='2026-11-01'
    assert not respond(db,f"#{p['id'][:8]} הופק",'wrong-kind')['changed']

def test_signed_webhook_owner_only_and_delivery_retry(db_session,monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from urllib.parse import urlencode
    from app.api.routes import operations_whatsapp as wa
    from app.db.session import get_db
    db=db_session;monkeypatch.setattr(office,'engine',db.get_bind());office.initialize();schema(db);db.commit()
    c=office.create(office.NewClient(name='לקוח דמה webhook'),db)
    app=FastAPI();app.include_router(wa.router);app.dependency_overrides[get_db]=lambda:db
    http=TestClient(app)
    for k,v in {'OPERATIONS_WHATSAPP_ENABLED':'1','TWILIO_AUTH_TOKEN':'test-only','TWILIO_ACCOUNT_SID':'ACtest','TWILIO_WHATSAPP_NUMBER':'+15550000001','OPERATIONS_OWNER_WHATSAPP':'+15550000002','OPERATIONS_WEBHOOK_URL':'https://example.test'+wa.PATH}.items():monkeypatch.setenv(k,v)
    params={'Body':['פתח תביעה ללקוח דמה webhook'],'From':['whatsapp:+15550000002'],'To':['whatsapp:+15550000001'],'AccountSid':['ACtest'],'MessageSid':['SM'+'a'*32]}
    headers={'content-type':'application/x-www-form-urlencoded'}
    content=urlencode(params,doseq=True)
    assert http.post(wa.PATH,content=content,headers=headers).status_code==403
    headers['x-twilio-signature']=wa.signature('https://example.test'+wa.PATH,params,'test-only')
    assert http.post(wa.PATH,content=content,headers=headers).status_code==200
    assert http.post(wa.PATH,content=content,headers=headers).status_code==200
    assert len(office.record(db,c['id'])['simpleProcesses'])==1
    params['From']=['whatsapp:+15559999999'];headers['x-twilio-signature']=wa.signature('https://example.test'+wa.PATH,params,'test-only')
    assert http.post(wa.PATH,content=urlencode(params,doseq=True),headers=headers).status_code==403
    monkeypatch.setenv('OPERATIONS_WHATSAPP_ENABLED','0')
    assert http.post(wa.PATH,content=content,headers=headers).status_code==503
