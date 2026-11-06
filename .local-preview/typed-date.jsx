import React,{useState,useRef,useEffect} from 'react';
import {parseTypedMoment,displayMoment} from './typed-date.js';
import './typed-date.css';
export default function TypedDate(props){return ['date','datetime-local'].includes(props.type)?<DateControl {...props}/>:<input {...props}/>;}
function DateControl({name,type='date',defaultValue='',value,required,disabled,min,max,onChange,onInput,onBlur,...props}){
 const [text,setText]=useState(()=>displayMoment(value??defaultValue,type)),field=useRef(null),last=useRef(value);
 const iso=parseTypedMoment(text,type);
 const error=text.trim()&&!iso?'יש להזין תאריך תקין'+(type==='datetime-local'?' ושעה בפורמט DD/MM/YYYY HH:mm':' בפורמט DD/MM/YYYY'):iso&&min&&iso<min?'התאריך מוקדם מהמותר':iso&&max&&iso>max?'התאריך מאוחר מהמותר':'';
 useEffect(()=>{field.current?.setCustomValidity(error);},[error]);
 useEffect(()=>{if(value!==undefined&&value!==last.current){setText(displayMoment(value,type));last.current=value;}},[value,type]);
 function edit(raw){setText(raw);const next=parseTypedMoment(raw,type);last.current=next;const event={target:{name,value:next},currentTarget:{name,value:next}};onChange?.(event);onInput?.(event);}
 return <span className="wf-date-control"><input {...props} ref={field} type="text" dir="ltr" placeholder={type==='datetime-local'?'DD/MM/YYYY HH:mm':'DD/MM/YYYY'} required={required} disabled={disabled} value={text} onChange={e=>edit(e.target.value)} onBlur={e=>{if(iso)setText(displayMoment(iso,type));onBlur?.(e);}}/>
 <input className="wf-date-picker" aria-label="בחירה ביומן" type={type} value={iso} min={min} max={max} disabled={disabled} onChange={e=>edit(displayMoment(e.target.value,type))} title="בחירת תאריך ביומן"/>
 <input type="hidden" name={name} value={iso} disabled={disabled}/></span>;
}
