from pathlib import Path
import shutil,datetime
root=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
backup=root/'backups'/('new-recruitment-'+datetime.datetime.now().strftime('%Y%m%d%H%M%S'))
backup.mkdir(parents=True)
for name in ['backend/app/services/sales.py','backend/app/services/recruitment_simple.py','backend/tests/test_recruitment_simple.py']:
 p=root/name;shutil.copy2(p,backup/p.name)
p=root/'backend/app/services/sales.py';s=p.read_text(encoding='utf-8');s=s.replace("if office.get('simpleOperations') and not is_appointment:","if not is_appointment:");p.write_text(s,encoding='utf-8')
p=root/'backend/app/services/recruitment_simple.py';s=p.read_text(encoding='utf-8');s=s.replace('Opt-in recruitment bridge.', 'New recruitment bridge.');s=s.replace(" sale_id=draft['sourceSaleId']", " c['simpleOperations']=True\n sale_id=draft['sourceSaleId']");p.write_text(s,encoding='utf-8')
p=root/'backend/tests/test_recruitment_simple.py';s=p.read_text(encoding='utf-8');s=s.replace(";c['simpleOperations']=True", "\n assert not c.get('simpleOperations')");s=s.replace("assert not saved['decisions'] and", "assert saved['simpleOperations'] is True\n assert not saved['decisions'] and");p.write_text(s,encoding='utf-8')
print('Updated new recruitment bridge and unflagged-client regression')
