from pathlib import Path
p=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations\frontend\src\pages\OperationsDesk.tsx')
s=p.read_text(encoding='utf-8');marker="{['new','reject'].includes(p.state)&&<button"
replacement="{['new','reject'].includes(p.state)&&p.kind!=='production'&&!(linked?.policy||p.policy)&&<p role=\"status\">כדי לסמן שנשלח לחברה: הזן ושמור למעלה את מספר הפוליסה / החשבון הקיים שאליו מתייחס הטיפול.</p>}\n    "+marker
assert marker in s;s=s.replace(marker,replacement);p.write_text(s,encoding='utf-8')
