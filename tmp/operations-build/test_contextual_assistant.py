import pytest
from app.services.contextual_assistant import resolve

def client(confirmed=False):
 return {'id':'c','name':'אברהם לוטה — עותק בדיקה','simpleProcesses':[{'id':'p','kind':'production','product':'ריסק רגיל','company':'איילון','category':'חיים','modeConfirmed':confirmed,'state':'new'}]}

def test_exact_screenshot_phrase_asks_only_missing_mode():
 c=client();r=resolve(None,'ריסק רגיל נשלח מסמכים לחברה','e',[c],'c','p')
 assert not r['changed'] and 'חדש או שחלוף' in r['reply'] and c['simpleProcesses'][0]['state']=='new'

@pytest.mark.parametrize('body',['ריסק רגיל נשלח מסמכים לחברה','ריסק רגיל נשלח לחברה','שלחתי מסמכים לחברה ריסק רגיל'])
def test_send_uses_selected_client_and_process(body):
 assert resolve(None,body,'e',[client(True)],'c','p')['command']=='#p נשלח'

def test_no_guess_between_change_and_production_or_negative_statement():
 c=client(True);c['simpleProcesses'].append({**c['simpleProcesses'][0],'id':'q','kind':'change'})
 assert 'כמה טיפולים' in resolve(None,'ריסק רגיל נשלח לחברה','e',[c],'c',None)['reply']
 assert 'command' not in (resolve(None,'ריסק רגיל לא נשלח לחברה','e',[c],'c','p') or {})
 assert resolve(None,'ריסק רגיל נשלח לחברה','e',[c],None,None) is None
