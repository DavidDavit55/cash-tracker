import {fetchFundOptions} from '../frontend/src/lib/pensionNetApi.js';

// A fixed public-data reader, not a general proxy. Never forwards request headers,
// cookies, client details, arbitrary URLs or search text to the external service.
export function createPublicCatalogueHandler(load=fetchFundOptions){
 const cache=new Map(),pending=new Map();
 return async (req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname!=='/preview-catalogue')return false;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  const send=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
  if(req.method!=='GET'){res.setHeader('Allow','GET');send(405,{error:'קריאת קטלוג בלבד'});return true;}
  const type=url.searchParams.get('type');
  if(!['pension','gemel'].includes(type)||[...url.searchParams.keys()].some(k=>k!=='type')||url.searchParams.getAll('type').length!==1){send(400,{error:'בקשת קטלוג לא תקינה'});return true;}
  try{
   let entry=cache.get(type);
   if(!entry||Date.now()-entry.at>3600000){
    if(!pending.has(type))pending.set(type,Promise.resolve().then(()=>load(type,AbortSignal.timeout(12000))).then(rows=>{
     if(!Array.isArray(rows)||!rows.length)throw Error('empty catalogue');
     const value={at:Date.now(),rows:rows.map(({id,name,manager,classification,reportPeriod})=>({id,name,manager,classification,reportPeriod}))};
     cache.set(type,value);return value;
    }).finally(()=>pending.delete(type)));
    entry=await pending.get(type);
   }
   send(200,{rows:entry.rows});
  }catch{send(502,{error:'לא ניתן לטעון כרגע את קטלוג המסלולים הציבורי. נסה שוב בעוד רגע.'});}
  return true;
 };
}
