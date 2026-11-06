from pathlib import Path
import shutil,datetime
r=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
p=r/'frontend/src/pages/OperationsDesk.tsx'
s=p.read_text(encoding='utf-8')
b=r/'backups'/('open-treatment-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'));b.mkdir(parents=True);shutil.copy2(p,b/p.name)
s=s.replace(' const initialized=useRef(false)', ''' const initialized=useRef(false)
 const treatmentRef=useRef<HTMLElement>(null),createRef=useRef<HTMLElement>(null)
 const [focusRequest,setFocusRequest]=useState(0)
 useEffect(()=>{if(!focusRequest)return;const target=creating?createRef.current:treatmentRef.current;target?.scrollIntoView({block:'start',behavior:'instant'});target?.focus({preventScroll:true})},[focusRequest])''')
s=s.replace('function choose(row:any){remember(row);','function choose(row:any,focus=true){if(focus)setFocusRequest(n=>n+1);remember(row);')
s=s.replace('if(row)choose({...row,clientId:c.id})','if(row)choose({...row,clientId:c.id},false)')
s=s.replace('function begin(){setNewCase(false);','function begin(){setFocusRequest(n=>n+1);setNewCase(false);')
s=s.replace('<button onClick={begin}>פתיחת טיפול</button>','<button onClick={begin}>פתיחת טיפול חדש</button>')
s=s.replace('{creating&&<section className="office-card">','{creating&&<section ref={createRef} tabIndex={-1} aria-label="פתיחת טיפול חדש" style={{scrollMarginTop:24}} className="office-card">')
s=s.replace('<section className="office-card op-workspace">','<section ref={treatmentRef} tabIndex={-1} aria-label="פרטי הטיפול שנבחר" style={{scrollMarginTop:24}} className="office-card op-workspace">')
p.write_text(s,encoding='utf-8')
print('Treatment opening now scrolls and focuses the selected panel, including repeated clicks.')
