from pathlib import Path
import shutil
p=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations\frontend\src\pages\OperationsDesk.tsx')
s=p.read_text(encoding='utf-8');shutil.copy2(p,p.with_suffix('.tsx.before-recruitment-selection'))
old="useEffect(()=>{if(initialized.current||!q.data)return;initialized.current=true;if(embeddedClient){setClientId(embeddedClient);const c=clients[0];const row=c?.processes.find((p:any)=>initialProcess?p.id===initialProcess:p.productId===initialProduct&&!['done','stopped'].includes(p.state));if(row)choose({...row,clientId:c.id},false)}},[q.data])"
new="useEffect(()=>{if(initialized.current||!q.data||!embeddedClient)return;setClientId(embeddedClient);const c=clients[0];if(!c)return;const row=c.processes.find((p:any)=>initialProcess?p.id===initialProcess:initialProduct?p.productId===initialProduct&&!['done','stopped'].includes(p.state):!['done','stopped'].includes(p.state))||(!initialProcess&&!initialProduct&&c.processes.length===1?c.processes[0]:undefined);if(row){initialized.current=true;choose({...row,clientId:c.id},false)}},[q.data,embeddedClient,initialProcess,initialProduct])"
assert old in s;s=s.replace(old,new);p.write_text(s,encoding='utf-8')
