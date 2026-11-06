from pathlib import Path
p=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations\frontend\src\pages\OperationsDesk.tsx');s=p.read_text(encoding='utf-8').replace("h.data?.outcome&&' · '+({payment:","h.data?.outcome&&' · '+(({payment:");p.write_text(s,encoding='utf-8')
