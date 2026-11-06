from pathlib import Path
root=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
p=root/'frontend/src/pages/OperationsDesk.tsx';s=p.read_text(encoding='utf-8')
s=s.replace('<label>קטגוריית הטיפול<select','{!p.category&&<label>קטגוריית הטיפול<select').replace('</select></label><label>מוצר לטיפול','</select></label>}{!p.product&&<label>מוצר לטיפול').replace('</select></label><label>חברה לטיפול','</select></label>}{!p.company&&<label>חברה לטיפול').replace('setCompany(e.target.value)}/></label>{p.kind', 'setCompany(e.target.value)}/></label>}{p.kind')
s=s.replace('<><div className="op-grid"><label>מועד המעקב','<><details open={[\'reject\',\'followup\'].includes(p.state)}><summary>תזכורת ופרטים נוספים{p.due?\' · \'+p.due:\'\'}</summary><div className="op-grid"><label>מועד המעקב')
s=s.replace('<div className="op-actions"><button disabled={busy||!due} onClick={()=>act(\'remind\',{due,time})}>עדכון תזכורת</button>','<button disabled={busy||!due} onClick={()=>act(\'remind\',{due,time})}>עדכון תזכורת</button></details><div className="op-actions">')
p.write_text(s,encoding='utf-8')
