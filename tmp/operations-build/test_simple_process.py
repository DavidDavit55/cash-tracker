import copy,uuid
import pytest
from fastapi import HTTPException
from app.services import simple_process as s
from app.api.routes import operations_whatsapp as wa

def client():return {'id':'demo','name':'דמה #01 בדיקת בוט','products':[],'operationalTasks':[]}
def run(c,p,action,**v):return s.transition(c,p['id'] if p else None,action,v,str(uuid.uuid4()))[1]
def create(c,kind='production',category='בריאות',product='בריאות',mode='new'):
    return run(c,None,'create',kind=kind,category=category,product=product,company='חברת דמה',mode=mode)

@pytest.mark.parametrize('kind',['production','claim','change'])
def test_end_to_end(kind):
    c=client();p=create(c,kind);assert p['state']=='new' and p['due'] is None
    p=run(c,p,'send',due=s.today());assert p['state']=='sent'
    p=run(c,p,'reject',detail='חסר פרט',due=s.today());assert p['state']=='reject'
    p=run(c,p,'send',due=s.today());assert p['state']=='sent'
    p=run(c,p,'result',verified=True,detail='תוצאה נבדקה ובוצעה')
    if kind=='production':p=run(c,p,'verify',detailsCorrect=True,termsCorrect=True,executionCorrect=True)
    p=run(c,p,'close',customerUpdated=True)
    assert p['state']=='done' and len(c['operationalTasks'])==1 and c['operationalTasks'][0]['status']=='done'
    assert not c['products']

@pytest.mark.parametrize('category,product,mode',[('בריאות','מחלות קשות','replace'),('חיים','ריסק משכנתא','replace'),('פנסיה','פנסיה','transfer'),('פיננסים','גמל להשקעה','transfer')])
def test_replacement_transfer_must_finish(category,product,mode):
    c=client();p=create(c,category=category,product=product,mode=mode);p=run(c,p,'send');p=run(c,p,'result')
    p=run(c,p,'verify',detailsCorrect=True,termsCorrect=True,executionCorrect=True)
    assert p['state']=='followup'
    with pytest.raises(HTTPException):run(c,p,'close',customerUpdated=True)
    p=run(c,p,'followup',verified=True,detail='ביצוע אומת')
    with pytest.raises(HTTPException):run(c,p,'close')
    assert run(c,p,'close',customerUpdated=True)['state']=='done'

def test_failed_action_atomic_and_gap_cycle():
    c=client();p=create(c);before=copy.deepcopy(c)
    with pytest.raises(HTTPException):run(c,p,'result')
    assert c==before
    p=run(c,p,'send');p=run(c,p,'result');before=copy.deepcopy(c)
    with pytest.raises(HTTPException):run(c,p,'verify',detailsCorrect=True)
    assert c==before
    p=run(c,p,'reject',detail='מחיר שגוי',due=s.today())
    with pytest.raises(HTTPException):run(c,p,'close',customerUpdated=True)
    p=run(c,p,'send');assert not p['verified']

def test_retry_one_process_one_task_and_no_false_status():
    c=client();data={'kind':'production','category':'בריאות','product':'בריאות','company':'דמה','mode':'new'}
    changed,p=s.transition(c,None,'create',data,'request-1')
    assert changed and s.transition(c,None,'create',data,'request-1')[0] is False
    assert len(c['simpleProcesses'])==len(c['operationalTasks'])==1
    assert not c.get('products') and not p.get('verified')
    p=run(c,p,'send');tid=c['operationalTasks'][0]['id'];p=run(c,p,'wait')
    assert c['operationalTasks'][0]['id']==tid and len(c['operationalTasks'])==1

def test_business_days_and_date_bounds():
    assert s.biz('2026-10-29')=='2026-11-03' # Thursday -> Sunday, Monday, Tuesday
    c=client();p=create(c)
    with pytest.raises(HTTPException):run(c,p,'remind',due='bad')
    p=run(c,p,'remind',due='2026-11-01',time='19:00');assert p['dueTime']=='19:00'
    p=run(c,p,'stop',detail='ויתור');assert c['operationalTasks'][0]['status']=='done'
    assert s.digest([c])['open']==0

def test_claim_dates_and_explicit_outcome():
    c=client();p=create(c,'claim')
    with pytest.raises(HTTPException):run(c,p,'send')
    p=run(c,p,'send',due=s.today())
    with pytest.raises(HTTPException):run(c,p,'result',detail='החברה אישרה')
    assert s.command('הלקוח אולי קיבל כסף') is None

def test_all_supported_products():
    for category,products in s.PRODUCTS.items():
        for product in products:
            c=client();p=create(c,category=category,product=product);assert p['product']==product
    with pytest.raises(HTTPException):create(client(),category='פיננסים',product='גמל',mode='replace')

def test_twilio_fail_closed_and_signature(monkeypatch):
    monkeypatch.delenv('OPERATIONS_WHATSAPP_ENABLED',raising=False)
    with pytest.raises(HTTPException) as exc:wa.validate({},'')
    assert exc.value.status_code==503
    config={'OPERATIONS_WHATSAPP_ENABLED':'1','TWILIO_AUTH_TOKEN':'test-token','TWILIO_ACCOUNT_SID':'ACtest','TWILIO_WHATSAPP_NUMBER':'+15550000001','OPERATIONS_OWNER_WHATSAPP':'+15550000002','OPERATIONS_WEBHOOK_URL':'https://example.test/api/operations/whatsapp/inbound'}
    for k,v in config.items():monkeypatch.setenv(k,v)
    params={'From':['whatsapp:+15550000002'],'To':['whatsapp:+15550000001'],'AccountSid':['ACtest'],'Body':['נשלח']}
    sig=wa.signature(config['OPERATIONS_WEBHOOK_URL'],params,'test-token');wa.validate(params,sig)
    with pytest.raises(HTTPException):wa.validate(params,'forged')
    params['From']=['whatsapp:+15550000003']
    with pytest.raises(HTTPException):wa.validate(params,wa.signature(config['OPERATIONS_WEBHOOK_URL'],params,'test-token'))
