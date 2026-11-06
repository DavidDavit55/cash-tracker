from pathlib import Path
import shutil,datetime
root=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
backup=root/'backups'/('appointment-bridge-'+datetime.datetime.now().strftime('%H%M%S'));backup.mkdir(parents=True)
for name in ['backend/app/services/sales.py','backend/app/services/recruitment_simple.py']:
 p=root/name;shutil.copy2(p,backup/p.name)
p=root/'backend/app/services/recruitment_simple.py';s=p.read_text(encoding='utf-8').replace('def connect(c,draft):','def connect(c,draft,appointment=False):').replace("{'kind':'production','category'", "{'kind':'appointment' if appointment else 'production','category'");p.write_text(s,encoding='utf-8')
p=root/'backend/app/services/sales.py';s=p.read_text(encoding='utf-8');start=s.index('    if is_appointment:\n',s.index("draft=next(d for d in office"));end=s.index("    if payload.get('health_join')",start);s=s[:start]+s[end:]
start=s.index('    simple_id=None');end=s.index('    result={"office_process_id"',start)
s=s[:start]+'''    from app.services.recruitment_simple import connect
    from app.services.office_integration import persist
    import copy
    previous=copy.deepcopy(office)
    simple_id=connect(office,draft,appointment=is_appointment)['id']
    persist(db,office,previous,'נפתח טיפול פשוט מהגיוס ללא הזנה חוזרת')
'''+s[end:];p.write_text(s,encoding='utf-8')
