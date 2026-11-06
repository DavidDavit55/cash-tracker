import copy
import pytest
from fastapi import HTTPException
from app.services.recruitment_simple import connect
from app.services.simple_process import transition

def test_bridge_preserves_details_no_duplicates_and_full_path():
 c={'products':[{'id':'p'}],'decisions':[],'operationalTasks':[{'id':'old','source':'recruitment','saleId':3}]}
 d={'id':'d','sourceSaleId':3,'productId':'p','officeFlow':{'draft':True,'sourceSnapshot':{'id':3,'company':'איילון','product':'ביטוח חיים','category':'סיכונים','base_amount':111},'agreed':{'premium':111}}};c['decisions']=[d]
 p=connect(c,d);assert p['state']=='new' and p['modeConfirmed'] is False
 assert p['agreed']['premium']==111 and p['productId']=='p'
 assert connect(c,d)['id']==p['id'];assert len(c['simpleProcesses'])==len(c['operationalTasks'])==1
 assert not c['decisions'] and c['legacyDraftArchive']==[d]
 with pytest.raises(HTTPException):transition(c,p['id'],'send',{},'bad-send')
 for action,data in [('details',{'category':'חיים','product':'ריסק רגיל','company':'איילון','mode':'new'}),('send',{}),('reject',{'detail':'חסר פרט','due':'2026-10-29'}),('send',{}),('result',{}),('verify',{'detailsCorrect':True,'termsCorrect':True,'executionCorrect':True}),('close',{'customerUpdated':True})]:
  _,p=transition(c,p['id'],action,data,action+str(len(p['history'])))
 assert p['state']=='done' and len(c['operationalTasks'])==1 and c['operationalTasks'][0]['status']=='done'

def test_sale_transaction_links_existing_client_and_retry(db_session,monkeypatch):
 from app.api.routes import office
 from app.services import sales
 from app.services.office_integration import schema,rows
 import json
 from sqlalchemy import text
 db=db_session;monkeypatch.setattr(office,'engine',db.get_bind());office.initialize();schema(db);db.commit()
 c=office.create(office.NewClient(name='דמה חיבור גיוס'),db);c['simpleOperations']=True
 db.execute(text('UPDATE office_clients SET payload=:p WHERE id=:id'),{'p':json.dumps(c),'id':c['id']});db.commit()
 payload={'client_name':c['name'],'office_client_id':c['id'],'category':'סיכונים','company':'איילון','product':'ביטוח חיים','sale_date':'2026-10-28','base_amount':111,'nifraim_factor':1,'request_id':'simple-sale'}
 r=sales.create_sale(db,payload);assert r['office_process_id']
 assert sales.create_sale(db,payload)==r
 saved=next(x for x in rows(db) if x['id']==c['id'])
 assert len(saved['products'])==len(saved['simpleProcesses'])==len(saved['operationalTasks'])==1
 assert not saved['decisions'] and saved['simpleProcesses'][0]['agreed']['premium']==111
 assert db.execute(text('SELECT COUNT(*) FROM sales')).scalar()==1
