import copy,json,uuid
import pytest
from sqlalchemy import text
from fastapi import HTTPException
from app.services import simple_process as s
from app.services.assistant_dialog import chat
from app.api.routes import office
from app.services.office_integration import schema

def action(c,p,a,**data):return s.transition(c,p['id'] if p else None,a,data,str(uuid.uuid4()))[1]

@pytest.mark.parametrize('kind',['production','appointment','change','claim'])
def test_four_complete_with_policy_reject_retry(kind,monkeypatch):
 monkeypatch.setattr(s,'today',lambda:'2026-10-28')
 c={'id':'demo','products':[{'id':'product','policy':''}],'operationalTasks':[]}
 p=action(c,None,'create',kind=kind,category='בריאות',product='בריאות',company='דמה',productId='product',mode='new')
 assert p['state']=='new'
 if kind!='production':
  with pytest.raises(HTTPException):action(c,p,'send',due='2026-11-01')
 p=action(c,p,'policy',policy='DEMO-123')
 p=action(c,p,'send',due='2026-11-01')
 expected=s.biz('2026-10-28',3 if kind=='production' else 10) if kind in ['production','appointment'] else '2026-11-01'
 assert p['due']==expected
 p=action(c,p,'wait',due='2026-11-04')
 assert p['due']==(s.biz('2026-10-28',3 if kind=='production' else 2) if kind in ['production','appointment'] else '2026-11-04')
 p=action(c,p,'reject',detail='חסר פרט',due='2026-11-01')
 p=action(c,p,'send',due='2026-11-01')
 p=action(c,p,'result',verified=True,detail='נבדק באתר החברה ובוצע')
 if kind=='production':
  with pytest.raises(HTTPException):action(c,p,'verify',detailsCorrect=True)
  p=action(c,p,'verify',detailsCorrect=True,termsCorrect=True,executionCorrect=True)
 p=action(c,p,'close',customerUpdated=True)
 assert p['state']=='done' and len(c['operationalTasks'])==1 and c['operationalTasks'][0]['status']=='done'
 p=action(c,p,'policy',policy='DEMO-124')
 assert p['state']=='done' and c['products'][0]['policy']=='DEMO-124'

def test_interrupt_date_create_claim_link_and_no_duplicate(db_session,monkeypatch):
 db=db_session;monkeypatch.setattr(office,'engine',db.get_bind());office.initialize();schema(db);db.commit()
 c=office.create(office.NewClient(name='אברהם דמה'),db)
 c['products']=[{'id':'health','name':'בריאות','category':'בריאות','company':'הראל','policy':'DEMO-1'}]
 office.save(db,c,c['revision'],'fixture')
 db.execute(text('CREATE TABLE office_assistant_dialog (id TEXT PRIMARY KEY,payload TEXT NOT NULL)'))
 db.execute(text('INSERT INTO office_assistant_dialog VALUES (:id,:p)'),{'id':'test','p':json.dumps({'stage':'date','action':'remind','client':c['id'],'process':'old'})});db.commit()
 def ask(msg):return chat(db,msg,str(uuid.uuid4()),'test',c['id'])
 r=ask('פתח תביעה לאברהם דמה');assert 'לאיזה מוצר' in r['reply'] and not r['changed']
 r=ask('1');assert r['changed'] and r['process']['kind']=='claim' and r['process']['productId']=='health'
 ask('פתח תביעה לאברהם דמה');r=ask('1');assert not r['changed']
 assert len(office.record(db,c['id'])['simpleProcesses'])==1
 ask('מה עכשיו');r=ask('שלחתי לחברה');assert 'תאריך' in r['reply']
 r=ask('30/10/2026');assert r['changed'] and r['process']['state']=='sent'
 ask('פתח מינוי סוכן לאברהם דמה');r=ask('1');assert r['process']['kind']=='appointment'
 ask('מה עכשיו');r=ask('שלחתי לחברה');assert r['process']['state']=='sent'

def test_change_sla_and_stop(monkeypatch):
 monkeypatch.setattr(s,'today',lambda:'2026-10-28')
 c={'products':[],'operationalTasks':[]}
 p=action(c,None,'create',kind='change',category='פיננסים',product='גמל',company='דמה',serviceType='fees',policy='DEMO')
 p=action(c,p,'send');assert p['due']==s.biz(s.today(),10)
 p=action(c,p,'wait');assert p['due']==s.biz(s.today(),2)
 p=action(c,p,'stop',detail='ויתור');assert not p['due'] and c['operationalTasks'][0]['status']=='done'
