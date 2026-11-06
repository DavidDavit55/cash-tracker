import {simpleParser} from '../backend/node_modules/mailparser/index.js';
import {getDocument} from '../backend/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import {convert} from '../backend/node_modules/html-to-text/lib/html-to-text.mjs';
export async function extractMail(row){
 try{
  const message=await simpleParser(row.raw,{skipTextToHtml:true,maxHtmlLengthToParse:1000000});
  const from=message.from?.value||[];
  const senderDomain=from.length===1?from[0].address?.split('@')[1]?.toLowerCase():'';
  const authentication=message.headerLines.filter(h=>h.key==='authentication-results').map(h=>h.line).filter(s=>/Authentication-Results:\s*mx\.google\.com;/i.test(s));
  const authenticatedDomains=authentication.length===1?[...new Set(authentication.flatMap(s=>[...s.matchAll(/dkim=pass\b[^;]*?header\.(?:i=@|d=)([a-z0-9.-]+)/gi)].map(m=>m[1].toLowerCase())))]:[];
  const documents=[];
  if((row.pdfs||[]).length>12)return {error:'יותר מדי קבצים מצורפים — נדרשת בדיקה'};
  for(const [index,pdf] of (row.pdfs||[]).entries()){
   const bytes=Buffer.from(pdf.data,'base64');if(bytes.length>15*1024*1024)return {error:'מסמך גדול מדי לפענוח אוטומטי'};
   const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:true});
   try{const doc=await task.promise;if(doc.numPages>20)return {error:'מסמך ארוך מדי לפענוח אוטומטי'};
    let text='';for(let p=1;p<=doc.numPages;p++){const page=await doc.getPage(p);const content=await page.getTextContent();text+=content.items.map(i=>i.str+(i.hasEOL?'\n':' ')).join('')+'\n';}
    if(text.trim().length<40)return {error:'PDF סרוק או ללא טקסט קריא — נדרש פענוח ידני'};
    documents.push({index,text:text.slice(0,200000)});
   }finally{await task.destroy();}
  }
  const body=message.text?.trim()||convert(message.html||'',{wordwrap:false,selectors:[{selector:'img',format:'skip'},{selector:'a',options:{ignoreHref:true}}]});
  return {senderAddress:from.length===1?from[0].address?.toLowerCase():'',senderDomain,authenticatedDomains,documents,body,text:[body,...documents.map(d=>d.text)].join('\n').slice(0,500000)};
 }catch{return {error:'פענוח מייל או מסמך נכשל — לא בוצע שינוי'};}
}
