from pathlib import Path
import shutil,datetime
root=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
src=Path(__file__).parent
mapping={'simple_process.py':'backend/app/services/simple_process.py','operations_bot.py':'backend/app/services/operations_bot.py','simple_operations.py':'backend/app/api/routes/simple_operations.py','operations_whatsapp.py':'backend/app/api/routes/operations_whatsapp.py','OperationsDesk.tsx':'frontend/src/pages/OperationsDesk.tsx','test_operations_bot.py':'backend/tests/test_operations_bot.py'}
backup=root/'backups'/('operations-update-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
for name,dest in mapping.items():
    p=root/dest
    if p.exists():
        b=backup/dest;b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,b)
    p.write_text((src/name).read_text(encoding='utf-8'),encoding='utf-8')
print('Updated local code only:',len(mapping))
