from app.api.routes import office
from app.services.office_integration import schema
from app.services.simple_process import transition
from app.services.assistant_dialog import chat

def test_dialog_client_product_action_date_retry_and_unknown(db_session,monkeypatch):
 db=db_session;monkeypatch.setattr(office,'engine',db.get_bind());office.initialize();schema(db);db.commit()
 c=office.create(office.NewClient(name='אברהם דמה'),db)
 _,p=transition(c,None,'create',{'kind':'claim','category':'בריאות','product':'בריאות','company':'מגדל'},'seed');office.save(db,c,c['revision'],'seed')
 def ask(msg,n):return chat(db,msg,str(n),'conversation')
 before=office.record(db,c['id'])['revision']
 assert 'איזה לקוח' in ask('צריך להתקדם עם זה',1)['reply']
 assert 'איזה מוצר' in ask('אברהם דמה',2)['reply']
 assert 'לאן להתקדם' in ask('בריאות',3)['reply']
 assert office.record(db,c['id'])['revision']==before
 assert 'תאריך' in ask('שלחתי את המסמכים',4)['reply']
 assert not ask('אולי מתישהו',5)['changed']
 r=ask('30/10/2026',6);assert r['changed'] and r['process']['state']=='sent' and r['process']['due']=='2026-10-30'
 revision=office.record(db,c['id'])['revision'];assert ask('30/10/2026',6)==r;assert office.record(db,c['id'])['revision']==revision
 assert 'לאן להתקדם' in ask('מה עכשיו',7)['reply']
 assert 'איזה לקוח' in ask('לקוח אחר',8)['reply']
 assert 'איזה לקוח' in chat(db,'1','other-event','other-conversation')['reply']
