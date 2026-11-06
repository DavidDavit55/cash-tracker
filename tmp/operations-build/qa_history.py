from pathlib import Path
p=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations\frontend\src\pages\OperationsDesk.tsx')
s=p.read_text(encoding='utf-8').replace("{h.data?.outcome&&' · '+", "{h.action==='result'&&h.data?.outcome&&' · '+").replace("denied:'דחייה'} as Record", "denied:'דחייה',completed:'בוצע'} as Record")
p.write_text(s,encoding='utf-8')
