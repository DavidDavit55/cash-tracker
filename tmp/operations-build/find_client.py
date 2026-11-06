from pathlib import Path
import sqlite3,json
p=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\מעקב עמלות\backend\commissions.db')
db=sqlite3.connect(p.as_uri()+'?mode=ro',uri=True)
for name, in db.execute("select name from sqlite_master where type='table'"):
    if name not in ['clients','policies','sales','recruitments']:continue
    cols=[r[1] for r in db.execute('pragma table_info("'+name+'")')]
    print(name,cols)
    for col in ['name','client_name']:
        if col in cols:
            rows=db.execute('select '+('id,' if 'id' in cols else '')+'"'+col+'" from "'+name+'" where "'+col+'" like ?',('%לוט%',)).fetchall()
            print('matches',rows)
