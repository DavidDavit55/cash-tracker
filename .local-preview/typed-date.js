export function parseTypedDate(value){
 const text=String(value||'').trim();
 let y,m,d,match;
 if((match=text.match(/^(\d{4})-(\d{2})-(\d{2})$/)))[,y,m,d]=match;
 else if((match=text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/)))[,d,m,y]=match;
 else return '';
 const iso=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
 const date=new Date(iso+'T12:00:00Z');
 return Number(y)>0&&Number.isFinite(+date)&&date.toISOString().slice(0,10)===iso?iso:'';
}
export const displayDate=value=>parseTypedDate(value)?parseTypedDate(value).split('-').reverse().join('/'):value||'';
export function parseTypedMoment(value,type='date'){
 if(type==='date')return parseTypedDate(value);
 const m=String(value||'').trim().match(/^(.+?)[T\s]+(\d{1,2}):(\d{2})$/);
 if(!m||Number(m[2])>23||Number(m[3])>59)return '';
 const date=parseTypedDate(m[1]);return date?`${date}T${m[2].padStart(2,'0')}:${m[3]}`:'';
}
export function displayMoment(value,type='date'){
 const iso=parseTypedMoment(value,type);return iso?displayDate(iso.slice(0,10))+(type==='datetime-local'?' '+iso.slice(11):''):value||'';
}
