import {useEffect,useRef,useState} from 'react';
import api from '../api/client';
import BudgetExport from './BudgetExport';
import './BudgetWorkspace.css';
const names={discount:'דיסקונט',cal:'כאל',max:'מקס',cash:'מזומן'};
export default function BudgetImport({apiClient=api,onDone=()=>{}}){
 const [source,setSource]=useState('discount'),[fileVersion,setFileVersion]=useState(0),[history,setHistory]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirm,setConfirm]=useState(null),[issues,setIssues]=useState([]);
 const lock=useRef(false);
 const refresh=()=>apiClient.get('/budget-workspace/imports').then(r=>setHistory(r.data));
 useEffect(()=>{apiClient.get('/budget-workspace/imports').then(r=>setHistory(r.data)).catch(()=>setMessage('לא ניתן לטעון את היסטוריית הייבוא'));},[apiClient]);
 async function upload(file){
  if(!file||lock.current)return;lock.current=true;setBusy(true);setMessage('קולט את התנועות…');setIssues([]);
  try{
   const fd=new FormData();fd.append('file',file);fd.append('source',source);fd.append('mode','money');
   const {data}=await apiClient.post('/budget-workspace/preview',fd);
   const selected=data.items.filter(r=>r.include).map(r=>r.id);
   const duplicates=data.items.filter(r=>r.duplicate).length;
   setIssues([...(data.issues||[]),...data.items.filter(r=>!r.include&&!r.duplicate).map(r=>`${r.label}: ${r.warning||'לא נקלטה'}`)]);
   if(!selected.length){setMessage(`אין תנועות חדשות לקליטה. ${duplicates} תנועות כבר קיימות.`);return;}
   const result=await apiClient.post(`/budget-workspace/imports/${data.id}/commit`,{selected,decisions:{}});
   setMessage(`נקלטו ${result.data.imported} תנועות. ${duplicates?`${duplicates} כפילויות דולגו.`:''}`);
   onDone();await refresh().catch(()=>setMessage(`נקלטו ${result.data.imported} תנועות. היסטוריית הייבוא לא התרעננה; אין צורך להעלות שוב.`));
  }catch(e){setMessage(e.response?.data?.error||'הקליטה לא הושלמה. אפשר להעלות שוב; כפילויות ייבדקו אוטומטית.');}
  finally{setBusy(false);lock.current=false;setFileVersion(v=>v+1);}
 }
 async function undo(id){setBusy(true);try{await apiClient.post(`/budget-workspace/imports/${id}/undo`);setConfirm(null);setMessage('הייבוא בוטל. יתר הנתונים נשמרו.');onDone();await refresh();}catch(e){setMessage(e.response?.data?.error||'ביטול הייבוא נכשל');}finally{setBusy(false);}}
 return <section className="bw-import bw"><header><h2>העלאת תנועות לתקציב</h2><p>בוחרים מקור וקובץ — התנועות נקלטות אוטומטית.</p></header><div className="bw-panel"><div className="bw-form"><label>מקור הנתונים<select disabled={busy} value={source} onChange={e=>setSource(e.target.value)}>{Object.entries(names).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label><label className="bw-file">קובץ תנועות<input key={source+fileVersion} type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={e=>upload(e.target.files[0])}/></label></div><small>כפילויות מדולגות אוטומטית. הנתונים הקיימים נשמרים.</small></div>
 <BudgetExport apiClient={apiClient}/>
 {message&&<p role="status" className="bw-message">{message}</p>}
 {issues.length>0&&<details className="bw-panel"><summary>תנועות שלא נקלטו ({issues.length})</summary><ul>{issues.map((s,i)=><li key={i}>{s}</li>)}</ul></details>}
 <details className="bw-panel"><summary>היסטוריית ייבוא · {history.length}</summary><p>כאן מופיעים ייבואים מהמנגנון החדש. הנתונים הישנים נשמרים בתקציב.</p>{history.map(h=><div className="bw-history" key={h.id}><div><b>{h.filename}</b><small>{names[h.source]} · {h.count} תנועות · {new Date(h.created_at).toLocaleDateString('he-IL')} · {h.status==='undone'?'בוטל':'נשמר'}</small></div>{h.status==='committed'&&<button className="bw-secondary" disabled={busy} onClick={()=>setConfirm(h.id)}>ביטול ייבוא</button>}{confirm===h.id&&<div><p>לבטל רק את התנועות שנוצרו בייבוא הזה? אם נערכו תנועות לאחר הייבוא, הביטול ייעצר.</p><button disabled={busy} onClick={()=>undo(h.id)}>אישור ביטול הייבוא</button><button className="bw-secondary" onClick={()=>setConfirm(null)}>חזרה</button></div>}</div>)}</details></section>;
}
