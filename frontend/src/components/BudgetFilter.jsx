import {useEffect,useId,useRef,useState} from 'react';

// null means all options, while [] deliberately means no options.
export default function BudgetFilter({label,allLabel,options,value,onChange}){
 const [open,setOpen]=useState(false);
 const root=useRef(null),trigger=useRef(null),all=useRef(null),id=useId();
 const selected=value===null?options.map(o=>o.value):value;
 const every=options.length>0&&options.every(o=>selected.includes(o.value));
 useEffect(()=>{if(all.current)all.current.indeterminate=!every&&selected.length>0;},[every,selected.length,open]);
 useEffect(()=>{
  if(!open)return;
  const outside=e=>{if(!root.current?.contains(e.target))setOpen(false);};
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 const summary=value===null||every?allLabel:selected.length===0?'לא נבחרו אפשרויות':selected.length===1?options.find(o=>o.value===selected[0])?.label||'אפשרות נבחרת':`${selected.length} נבחרו`;
 return <div className="bw-filter" ref={root} onBlur={e=>{if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget))setOpen(false);}} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}}}>
  <span id={id+'-label'}>{label}</span>
  <button type="button" className="bw-filter-trigger" ref={trigger} aria-label={`סינון ${label}: ${summary}`} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(v=>!v)}>{summary}<span aria-hidden="true">⌄</span></button>
  {open&&<div id={id} className="bw-filter-options" role="group" aria-labelledby={id+'-label'}>
   <label className="bw-filter-all"><input ref={all} type="checkbox" checked={value===null||every} onChange={()=>onChange(value===null||every?[]:null)}/>{allLabel}</label>
   {options.map(option=><label key={option.value}><input type="checkbox" checked={selected.includes(option.value)} onChange={e=>{const next=e.target.checked?[...selected,option.value]:selected.filter(v=>v!==option.value);onChange(options.every(o=>next.includes(o.value))?null:next);}}/>{option.label}</label>)}
  </div>}
 </div>;
}
