from pathlib import Path
import shutil,datetime
root=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
p=root/'frontend/src/pages/office-view-model.js'
s=p.read_text(encoding='utf-8');needle='return homeTasks(clients,today).map(t=>'
assert needle in s
b=root/'backups'/('remove-office-intro-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'));b.mkdir(parents=True);shutil.copy2(p,b/p.name)
s=s.replace(needle,"return homeTasks(clients,today).filter(t=>!t.id.endsWith(':intro')).map(t=>")
p.write_text(s,encoding='utf-8')
print('Removed synthetic introductory-call task from Office projection only')
