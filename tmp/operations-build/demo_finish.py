from pathlib import Path
root=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
p=root/'backend/app/services/assistant_queries.py';s=p.read_text(encoding='utf-8').replace('transition,reply,STATES,next_title','transition,reply,STATES,next_title,KINDS').replace("· {p.get('product') or", "· {KINDS[p['kind']]} · {p.get('product') or");p.write_text(s,encoding='utf-8')
p=root/'frontend/src/pages/ClientPage.tsx';s=p.read_text(encoding='utf-8').replace('({embedded=false,clientName,productScope}:{embedded?:boolean;', '({embedded=false,clientName,productScope,operationsOnly=false}:{operationsOnly?:boolean;embedded?:boolean;').replace('{p.policy_id != null && (','{!operationsOnly && p.policy_id != null && (');p.write_text(s,encoding='utf-8')
p=root/'frontend/src/pages/OfficePage.tsx';s=p.read_text(encoding='utf-8').replace('<ClientPage key={c.id} embedded','<ClientPage key={c.id} operationsOnly={!!(c as any).simpleOperations} embedded');p.write_text(s,encoding='utf-8')
