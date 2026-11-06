import {simpleParser} from '../backend/node_modules/mailparser/index.js';
import {convert} from '../backend/node_modules/html-to-text/lib/html-to-text.mjs';

export async function readableMail(raw){
 if(!raw?.length||raw.length>30*1024*1024)throw Error('size');
 const m=await simpleParser(raw,{skipHtmlToText:true,skipTextToHtml:true,skipImageLinks:true});
 const text=m.text||convert(m.html||'',{selectors:[{selector:'img',format:'skip'},{selector:'a',options:{ignoreHref:true}}]});
 return {subject:m.subject||'ללא נושא',from:m.from?.text||'',to:m.to?.text||'',cc:m.cc?.text||'',date:m.date?.toISOString()||'',text:text.slice(0,300000),truncated:text.length>300000,attachments:m.attachments.map((a,index)=>({index,name:a.filename||'attachment',size:a.size,type:a.contentType})),parsedAttachments:m.attachments};
}
export function createMailView(pool){return async(req,res)=>{
 res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');
 try{
  const sent=req.params.kind==='sent';
  if(!sent&&req.params.kind!=='received')return res.sendStatus(404);
  const {rows}=await pool.query(sent?"SELECT raw FROM staging_mail_sends WHERE owner_id=$1 AND send_key=$2 AND status='sent'":'SELECT raw FROM staging_read_messages WHERE owner_id=$1 AND id=$2',[req.user.id,req.params.id]);
  if(!rows[0]?.raw)return res.sendStatus(404);
  const {parsedAttachments,...mail}=await readableMail(sent?Buffer.from(rows[0].raw,'base64url'):rows[0].raw);
  if(req.query.attachment!==undefined){
   const index=String(req.query.attachment);if(!/^\d+$/.test(index)||!parsedAttachments[Number(index)])return res.sendStatus(404);
   const a=parsedAttachments[Number(index)];res.set('Content-Type','application/octet-stream');res.set('Content-Security-Policy',"default-src 'none'; sandbox");res.set('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(a.filename||'attachment'));return res.send(a.content);
  }
  res.json(mail);
 }catch{res.status(422).json({error:'לא ניתן להציג את המייל. אפשר להוריד את קובץ ה־EML המקורי.'});}
};}
