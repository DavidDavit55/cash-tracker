from pathlib import Path
import shutil,datetime,json,hashlib
root=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
source=Path(__file__).parent
backup=root/'backups'/('operations-code-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
mapping={'simple_process.py':'backend/app/services/simple_process.py','simple_operations.py':'backend/app/api/routes/simple_operations.py','operations_whatsapp.py':'backend/app/api/routes/operations_whatsapp.py','OperationsDesk.tsx':'frontend/src/pages/OperationsDesk.tsx','OperationsDesk.css':'frontend/src/pages/OperationsDesk.css','test_simple_process.py':'backend/tests/test_simple_process.py'}
edits={}
p=root/'backend/app/main.py';s=p.read_text(encoding='utf-8');needle='app.include_router(office.router)'
assert needle in s and 'simple_operations' not in s
edits[p]=s.replace(needle,needle+'\nfrom app.api.routes import simple_operations, operations_whatsapp\napp.include_router(simple_operations.router)\napp.include_router(operations_whatsapp.router)')
p=root/'backend/app/office_security.py';s=p.read_text(encoding='utf-8');needle='if mutating and not settings.disable_auth:';assert needle in s
edits[p]=s.replace(needle,"# Only the signed, allowlisted Twilio route uses provider auth instead of browser Origin.\n  signed_webhook=request.url.path=='/api/operations/whatsapp/inbound'\n  if mutating and not settings.disable_auth and not signed_webhook:")
p=root/'frontend/src/App.tsx';s=p.read_text(encoding='utf-8');needle='      <Routes>';assert needle in s
s="import OperationsDesk from '@/pages/OperationsDesk'\n"+s
edits[p]=s.replace(needle,needle+'\n        <Route path="/operations" element={<RequireAuth><OperationsDesk /></RequireAuth>} />')
p=root/'frontend/src/pages/OfficeDashboard.tsx';s=p.read_text(encoding='utf-8');needle='<h1>היום שלי</h1>';assert needle in s
edits[p]=s.replace(needle,needle+'<Link to="/operations">הפקות, תביעות ושינויים — שולחן עבודה</Link>')
p=root/'frontend/src/pages/office-view-model.js';s=p.read_text(encoding='utf-8');needle='export function taskHref(t){';assert needle in s
edits[p]=s.replace(needle,needle+"if(t.manualId?.startsWith('simple:'))return '/operations';")
for src,dest in mapping.items():
    p=root/dest
    assert not p.exists(),f'Will not overwrite {p}'
    edits[p]=(source/src).read_text(encoding='utf-8')
backup.mkdir(parents=True)
manifest=[]
for p,s in edits.items():
    if p.exists():
        b=backup/p.relative_to(root);b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,b)
    manifest.append({'path':str(p.relative_to(root)),'previousSha256':hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None})
for p,s in edits.items():p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s,encoding='utf-8')
(backup/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Installed '+str(len(edits))+' files; code backup: '+str(backup))
