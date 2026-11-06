import copy,json,uuid
import pytest
from fastapi import HTTPException
from sqlalchemy import text
from app.services import simple_process as s
from app.services import assistant_dialog as dialog
from app.api.routes import office,simple_operations as api

def act(c,p,a,**v):return s.transition(c,p['id'] if p else None,a,v,str(uuid.uuid4()))[1]
def seed(kind='production',**v):
 c={'id':'qa','revision':1,'name':'דמה','products':[{'id':'p','company':'הראל','policy':'DEMO'}]}
 p=act(c,None,'create',kind=kind,category='בריאות',product='בריאות',company='הראל',productId='p',mode=v.pop('mode','new'),**v)
 return c,p

def test_wrong_company_rejected():
 c,p=seed()
 with pytest.raises(HTTPException):act(c,None,'create',kind='claim',category='בריאות',product='בריאות',company='אחר',productId='p')
 with pytest.raises(HTTPException):act(c,p,'details',category='בריאות',product='בריאות',company='אחר',mode='new')

def test_new_claim_event_and_retry():
 c,p=seed('claim');base=dict(kind='claim',category='בריאות',product='בריאות',company='הראל',productId='p',newCase=True,caseDescription='אירוע נוסף')
 changed,q=s.transition(c,None,'create',base,'new-case')
 assert changed and q['id']!=p['id'] and len(c['simpleProcesses'])==2
 assert not s.transition(c,None,'create',base,'new-case')[0]
 assert len(c['operationalTasks'])==2

def test_time_survives_send_wait_policy():
 c,p=seed('claim');p=act(c,p,'send',due='2026-11-01',time='14:00');assert p['dueTime']=='14:00'
 p=act(c,p,'wait',due='2026-11-03');assert p['dueTime']=='14:00'
 p=act(c,p,'policy',policy='NEW');assert p['dueTime']=='14:00'
 assert c['operationalTasks'][0]['dueTime']=='14:00'

def test_replacement_due_and_early_completion():
 c,p=seed(mode='replace');p=act(c,p,'send');p=act(c,p,'result')
 with pytest.raises(HTTPException):act(c,p,'verify',detailsCorrect=True,termsCorrect=True,executionCorrect=True)
 p=act(c,p,'verify',detailsCorrect=True,termsCorrect=True,executionCorrect=True,effective='2026-11-01')
 assert p['due']==s.biz('2026-11-01',14)
 p=act(c,p,'followup',verified=True,detail='ביטול דמה אושר מוקדם');assert p['state']=='handled'

@pytest.mark.parametrize('outcome',['payment','approval','partial','denied'])
def test_claim_outcomes(outcome):
 c,p=seed('claim');p=act(c,p,'send',due='2026-11-01');p=act(c,p,'result',verified=True,detail='תוצאת דמה והחלטת המשך',outcome=outcome)
 assert p['outcome']==outcome and p['history'][-1]['data']['detail']

def test_selected_process_overrides_old_conversation(db_session,monkeypatch):
 c,old=seed();new=act(c,None,'create',kind='production',category='חיים',product='ריסק רגיל',company='איילון',mode='new')
 monkeypatch.setattr(dialog,'clients',lambda db:[c]);monkeypatch.setattr(office,'save',lambda *a:None)
 db=db_session;db.execute(text('CREATE TABLE office_assistant_dialog(id TEXT PRIMARY KEY,payload TEXT NOT NULL)'))
 db.execute(text('INSERT INTO office_assistant_dialog VALUES(:id,:p)'),{'id':'qa','p':json.dumps({'client':c['id'],'process':old['id'],'stage':'date','action':'remind'})});db.commit()
 result=dialog.chat(db,'שלחתי לחברה','selected-event','qa',c['id'],new['id'])
 assert result['process']['id']==new['id'] and result['process']['state']=='sent'
 assert next(p for p in c['simpleProcesses'] if p['id']==old['id'])['state']=='new'

def test_creation_questions_survive_ui_context(db_session,monkeypatch):
 c,p=seed();monkeypatch.setattr(dialog,'clients',lambda db:[c]);monkeypatch.setattr(office,'save',lambda *a:None)
 r=dialog.chat(db_session,'פתח תביעה לדמה','c1','qa',c['id'],p['id']);assert r['choices']
 r=dialog.chat(db_session,'1','c2','qa',c['id'],p['id']);assert r['process']['kind']=='claim'
