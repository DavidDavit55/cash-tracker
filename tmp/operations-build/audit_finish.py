from pathlib import Path
r=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
p=r/'frontend/src/pages/OperationsDesk.tsx';s=p.read_text(encoding='utf-8')
s=s.replace("function selectProduct(id:string){setProductId(id);", "function selectProduct(id:string){setProductId(id);setServiceType('');")
s=s.replace('<option value="investment">מסלול השקעה</option><option value="fees">דמי ניהול</option>',"{['פנסיה','פיננסים'].includes(category)&&<><option value=\"investment\">מסלול השקעה</option><option value=\"fees\">דמי ניהול</option></>}")
s=s.replace("check('verified','בדקתי שהתוצאה בוצעה בפועל; בתביעת תשלום — שהכסף התקבל; במינוי — שהמינוי נקלט באתר החברה')", "check('verified',p.kind==='appointment'?'בדקתי שמינוי הסוכן נקלט בחברה':p.kind==='claim'?(outcome==='payment'?'בדקתי שהתשלום התקבל':outcome==='approval'?'בדקתי שהתקבל אישור החברה':'בדקתי את החלטת החברה ותיעדתי את החלטת ההמשך'):'בדקתי שהשינוי בוצע כפי שהתבקש')")
# Avoid displaying pre-send instructions after the work is already handled.
s=s.replace("<><p>{autoDays?", "<>{p.state!=='handled'&&<p>{autoDays?")
s=s.replace("אין זמן אחיד לכל תביעה או שינוי.'}</p>{!autoDays&&", "אין זמן אחיד לכל תביעה או שינוי.'}</p>}{!autoDays&&p.state!=='handled'&&")
p.write_text(s,encoding='utf-8')
p=r/'backend/tests/test_four_flows.py';s=p.read_text(encoding='utf-8');s=s.replace("assert p['state']=='new'", "assert p['state']=='new' and c['simpleOperations'] is True");p.write_text(s,encoding='utf-8')
print('Refined context-specific labels and regression assertion')
