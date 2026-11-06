import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export const GMAIL_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const nonce=()=>randomBytes(32).toString('base64url');
export function encryptionKey(env=process.env){
 const key=Buffer.from(env.GMAIL_ENCRYPTION_KEY||'','base64');
 if(key.length!==32)throw new Error('gmail_config');return key;
}
export function seal(value,key,context){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from(context));
 const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),data.toString('base64')].join('.');
}
export function unseal(value,key,context){
 const [version,iv,tag,data]=value.split('.');if(version!=='v1')throw new Error('cipher_version');
 const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64'));
 cipher.setAAD(Buffer.from(context));cipher.setAuthTag(Buffer.from(tag,'base64'));
 return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data,'base64')),cipher.final()]).toString('utf8'));
}
export async function gmailConfig(env=process.env){
 if(env.GMAIL_ENABLED!=='true')throw new Error('gmail_disabled');
 const web=env.GMAIL_CREDENTIALS_FILE?JSON.parse(await readFile(env.GMAIL_CREDENTIALS_FILE,'utf8')).web:{client_id:env.GMAIL_CLIENT_ID,client_secret:env.GMAIL_CLIENT_SECRET};
 const allowed=[...new Set((env.GMAIL_ALLOWED_EMAILS||env.GMAIL_ALLOWED_EMAIL||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean))];
 if(!web?.client_id||!web.client_secret||!allowed.length||allowed.some(s=>!/^\S+@\S+\.\S+$/.test(s)))throw new Error('gmail_config');
 const redirect=new URL(env.GMAIL_REDIRECT_URI),front=new URL(env.GMAIL_FRONTEND_URL);
 for(const u of [redirect,front]){
  if(u.username||u.password||u.search||u.hash)throw new Error('gmail_config');
  if(u.protocol!=='https:'&&!(env.NODE_ENV!=='production'&&u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw new Error('gmail_config');
 }
 if(redirect.pathname!=='/api/admin/gmail/callback')throw new Error('gmail_config');
 return {...web,key:encryptionKey(env),redirect:redirect.href,front:front.origin,allowed,secure:redirect.protocol==='https:'};
}
export function oauthUrl(c,state,verifier,email){
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:c.client_id,redirect_uri:c.redirect,response_type:'code',scope:GMAIL_SCOPE,state,
 access_type:'offline',prompt:'consent select_account',login_hint:email,
 code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();return url.href;
}
async function jsonRequest(url,options={},request=fetch){
 const response=await request(url,{...options,signal:AbortSignal.timeout(20000)});
 if(!response.ok){const err=new Error('google_request');err.status=response.status;throw err;}
 return response.json();
}
export async function exchangeToken(c,params,request=fetch){
 return jsonRequest('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.client_id,client_secret:c.client_secret,...params})},request);
}
export async function gmailGet(path,token,request=fetch){
 return jsonRequest(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`,{headers:{Authorization:`Bearer ${token}`}},request);
}
export function nationalIds(text=''){
 const candidates=[...(text.match(/(?<!\d)\d{9}(?!\d)/g)||[])];
 for(const m of text.matchAll(/(?:ת[.״"']?\s*ז[.״"']?|תעודת\s*זהות)\s*[:#-]?\s*(\d{5,9})(?!\d)/g))candidates.push(m[1].padStart(9,'0'));
 return [...new Set(candidates.filter(id=>id!=='000000000'&&[...id].reduce((sum,d,i)=>{const n=Number(d)*(i%2+1);return sum+(n>9?n-9:n);},0)%10===0))];
}
// Read text MIME parts only. Never fetch attachments or retain the message body.
export function scanBody(payload){
 const ids=new Set();let bytes=0,parts=0,read=false,partial=false;
 function visit(part,depth=0){
  if(!part)return;
  if(++parts>100||depth>15){partial=true;return;}
  const headers=part.headers||[];
  const header=name=>headers.find(h=>h.name?.toLowerCase()===name)?.value||'';
  if(part.filename||/^attachment\b/i.test(header('content-disposition')))return;
  const mime=(part.mimeType||'').toLowerCase();
  if(mime.startsWith('multipart/')){for(const child of part.parts||[])visit(child,depth+1);return;}
  if(!['text/plain','text/html'].includes(mime))return;
  if(part.body?.attachmentId&&!part.body?.data){partial=true;return;}
  if(typeof part.body?.data!=='string')return;
  if(part.body.data.length>1400000||bytes>1000000){partial=true;return;}
  try{
   const buffer=Buffer.from(part.body.data,'base64url');bytes+=buffer.length;
   if(bytes>1000000){partial=true;return;}
   const charset=header('content-type').match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1]||'utf-8';
   let text=new TextDecoder(charset,{fatal:true}).decode(buffer);
   if(mime==='text/html')text=text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ').replace(/<[^>]*>/g,' ').replace(/&(?:#(\d+)|#x([a-f\d]+)|nbsp|quot|amp);/gi,(s,dec,hex)=>{if(dec||hex){const n=parseInt(dec||hex,dec?10:16);return n<=0x10ffff?String.fromCodePoint(n):' ';}return s.toLowerCase()==='&quot;'?'"':' ';});
   for(const id of nationalIds(text))ids.add(id);read=true;
  }catch{partial=true;}
 }
 visit(payload);
 return {ids:[...ids],status:partial?'partial':read?'complete':'no_text'};
}
export function normalizeMessage(message,{readBody=false}={}){
 const headers=message.payload?.headers||[];
 const header=name=>headers.filter(h=>h.name.toLowerCase()===name).map(h=>h.value).join(', ').slice(0,12000);
 const ms=Number(message.internalDate);
 if(!message.id||!message.threadId||!Number.isFinite(ms)||ms<=0)throw new Error('message_invalid');
 return {id:message.id,threadId:message.threadId,at:new Date(ms),direction:message.labelIds?.includes('SENT')?'outgoing':'incoming',
 metadata:{subject:header('subject'),from:header('from'),to:header('to'),cc:header('cc'),bulk:!!header('list-unsubscribe')||!!header('list-id'),promotional:message.labelIds?.includes('CATEGORY_PROMOTIONS')||false,...(readBody?{bodyScan:scanBody(message.payload)}:{})}};
}
export function suggestClients(metadata,clients,ownEmails=[]){
 const own=new Set(ownEmails.map(s=>s.toLowerCase()));
 const addresses=new Set(([metadata.from,metadata.to,metadata.cc].join(' ').match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).map(s=>s.toLowerCase()));
 for(const email of own)addresses.delete(email);
 const subjectIds=new Set(nationalIds(metadata.subject));
 const ids=new Set([...subjectIds,...(metadata.bodyScan?.ids||[])]);
 return clients.flatMap(c=>{
  if(c.email&&own.has(c.email.toLowerCase()))return [];
  const id=String(c.id_number||'').replace(/\D/g,'');
  const reason=id.length>=5&&id.length<=9&&ids.has(id.padStart(9,'0'))?`תעודת זהות ${subjectIds.has(id.padStart(9,'0'))?'בנושא':'בגוף ההודעה'} — נדרש אישור`:c.email&&addresses.has(c.email.toLowerCase())?'כתובת מייל זהה — נדרש אישור':null;
  return reason?[{id:c.id,name:c.name,reason}]:[];
 });
}

// Conservative triage, not proof of identity or an assurance of irrelevance.
// Ambiguous body results require review; existing manual links remain unchanged.
export function classifyMessage(metadata,suggestions=[],linked=false,override=null){
 if(linked)return {bucket:'relevant',reason:'שויך ידנית ללקוח'};
 if(new Set([...nationalIds(metadata.subject),...(metadata.bodyScan?.ids||[])]).size>1)return {bucket:'review',reason:'נמצאו כמה תעודות זהות — ייתכן דוח מרוכז; נדרשת בדיקה ידנית'};
 if(metadata.bodyScan?.status==='partial')return {bucket:'review',reason:'גוף ההודעה נסרק חלקית — נדרשת בדיקה ידנית'};
 if(suggestions.length>1)return {bucket:'review',reason:'נמצאו כמה לקוחות אפשריים — נדרשת בדיקה ידנית'};
 if(override)return {bucket:override,reason:'סיווג ידני'};
 if(suggestions.length)return {bucket:'relevant',reason:'נמצאה התאמה אפשרית ללקוח — נדרש אישור'};
 if(metadata.bodyScan?.ids?.length)return {bucket:'review',reason:'נמצאה תעודת זהות בגוף ההודעה ללא התאמה ללקוח — נדרשת בדיקה'};
 const subject=metadata.subject||'',from=metadata.from||'';
 if(/פוליס|הפקד|ניוד|חשבת?\s*שכר|תלוש|תביע|חיתום|ריג.?קט|דחיי?ת|מסמכ|מסמך|מינוי\s*סוכן|נספח|הצטרפות|תעודת\s*זהות|ת[.״"']\s*ז|(?<!\d)\d{9}(?!\d)/i.test(subject))return {bucket:'review',reason:'סימן לתהליך שירות; נדרשת בדיקה'};
 const promotion=/פרסומת|מבצע|קופון|הנחה|ניוזלטר|newsletter|\bsale\b|\bdiscount\b|\bunsubscribe\b/i.test(subject);
 const retailer=/קרפור|\bcarrefour\b/i.test(from+' '+subject);
 if(metadata.promotional||metadata.bulk||promotion||retailer)return {bucket:'hidden',reason:'חשד לפרסום או דיוור — אפשר לבדוק ולהחזיר'};
 return {bucket:'review',reason:'לא נמצאה התאמה מספקת ללקוח'};
}
