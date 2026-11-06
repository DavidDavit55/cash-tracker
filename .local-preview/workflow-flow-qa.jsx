// Component-level browser regression fixture. In-memory only: no store or sends.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Operation from './workflow-operation.jsx';
import Followup from './workflow-followup.jsx';
import {completeTask,closeTreatment} from './workflow-process.js';
import {completeDecision} from './workflow-model.js';
import './workflow-demo.css';
import './workflow-v2.css';
import './workflow-brand.css';
const product={id:'qa-product',company:'הפניקס',policy:'QA-ONLY',category:'פנסיה',balance:100000,asOf:'2026-08-31',coverage:[]};
const decision={id:'qa-decision',productId:product.id,action:'ניוד קרן פנסיה בהתאם לסיכום',target:'הראל',sourceBalance:100000,sourceAsOf:product.asOf,policy:'QA-TARGET',depositFee:1,balanceFee:.1};
function App(){
 const [client,setClient]=useState({products:[product],decisions:[decision],appointments:[]}),[error,setError]=useState('');
 const d=client.decisions[0],change=patch=>{setClient(c=>({...c,decisions:[{...c.decisions[0],...patch}]}));return true;};
 return <div className="wf" dir="rtl"><main style={{maxWidth:1100,margin:'auto',padding:24}}><h1>בדיקת רכיבי תפעול — סינתטי בלבד</h1><p>התרחיש לא נשמר ולא שולח דבר. משתמש ברכיבי ה־CRM עצמם.</p><button onClick={()=>setClient({products:[product],appointments:[],decisions:[{...decision,produced:true,tasks:{verify:{done:true},deliver:{done:true}}}]})}>תרחיש בדיקת סגירה</button>{error&&<p role="alert">{error}</p>}
 <Operation d={d} p={product} summarySent={true} change={change} template={()=>change({messagePrepared:true,messageText:'נוסח בדיקה בלבד'})} mail={kind=>{if(kind==='אישור')change({approved:true,evidence:'אישור דמה',effective:'2026-09-28'});else change({receipt:true});}} finish={()=>{try{setClient(c=>completeDecision(c,d));}catch(e){setError(e.message);}}}/>
 {d.produced&&!d.completed&&<Followup d={d} change={change} onTask={(key,data)=>setClient(c=>completeTask(c,d.id,key,data))} onClose={()=>setClient(c=>closeTreatment(c,d))}/>}
 <p role="status">{d.completed?'הבדיקה הסתיימה — המהלך נסגר':d.produced?'מוצר היעד עודכן בתיק':client.products.length+' מוצרים'}</p></main></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
