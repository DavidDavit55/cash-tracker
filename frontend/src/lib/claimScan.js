import {createWorker} from 'tesseract.js';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc=pdfWorker;
// Only deterministic candidates. Never infer client identity or coverage.
export function candidates(text){
 const match=pattern=>text.match(pattern)?.[1]?.trim()||'';
 return {provider:match(/(?:ד[״"׳']ר|דוקטור)\s+([א-ת]+(?:[ -][א-ת]+){0,2})/),date:match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/),invoice:match(/(?:חשבונית(?:\s*מס)?\s*[/־-]?\s*קבלה|קבלה|חשבונית)\s*(?:מס[׳'״".]?\s*)?[#:：]?\s*(\d{3,12})/),amount:match(/(?:סה[״"]?כ|סך\s*הכל|לתשלום)\s*[:：]?\s*(?:₪\s*)?([\d,]+(?:\.\d{1,2})?)/).replaceAll(',','')};
}
export async function scanClaimFile(file,{signal,onProgress=()=>{}}={}){
 if(file.size>15*1024*1024)throw Error('מקסימום 15MB לקובץ.');
 if(!/\.(pdf|png|jpe?g)$/i.test(file.name))throw Error('אפשר לסרוק PDF, PNG או JPG בלבד.');
 let worker,pdf,pdfTask,image;
 const check=()=>{if(signal?.aborted)throw Error('הסריקה בוטלה');};
 const cancel=()=>{worker?.terminate().catch(()=>{});pdfTask?.destroy().catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
 try{
 check();const bytes=await file.arrayBuffer();check();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 if(/\.pdf$/i.test(file.name)){pdfTask=pdfjs.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:true});pdf=await pdfTask.promise;if(pdf.numPages>12)throw Error('מקסימום 12 עמודים לסריקה. יש לפצל את הקובץ.');}
 else image=await createImageBitmap(file);
 const count=pdf?.numPages||1,results=[];
 for(let n=1;n<=count;n++){
 check();onProgress(`מפענח עמוד ${n} מתוך ${count}`);let text='',method='text',confidence=null;const page=pdf?await pdf.getPage(n):null;
 if(page){const content=await page.getTextContent();text=content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('');}
 if(text.trim().length<60||text.includes('�')){
 method='ocr';const canvas=document.createElement('canvas');let viewport;
 if(page){viewport=page.getViewport({scale:1});viewport=page.getViewport({scale:Math.min(2.5,2200/Math.max(viewport.width,viewport.height))});canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;}
 else{const scale=Math.min(1,2200/Math.max(image.width,image.height));canvas.width=image.width*scale;canvas.height=image.height*scale;canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);}
 check();worker??=await createWorker(['heb','eng'],1,{workerPath:location.origin+'/claim-scan/worker.min.js',corePath:location.origin+'/claim-scan',langPath:location.origin+'/claim-scan',workerBlobURL:false,cacheMethod:'none'});check();
 const first=(await worker.recognize(canvas)).data;let best=first;
 if(first.confidence<75){const rotated=document.createElement('canvas');rotated.width=canvas.width;rotated.height=canvas.height;const ctx=rotated.getContext('2d');ctx.translate(rotated.width,rotated.height);ctx.rotate(Math.PI);ctx.drawImage(canvas,0,0);check();const second=(await worker.recognize(rotated)).data;if(second.confidence>first.confidence)best=second;rotated.width=rotated.height=0;}
 text=best.text;confidence=best.confidence;canvas.width=canvas.height=0;
 }
 check();results.push({page:n,method,confidence,text:text.slice(0,18000),...candidates(text),include:false,verified:false});
 }
 return {hash,name:file.name,pages:results};
 }finally{signal?.removeEventListener('abort',cancel);await worker?.terminate().catch(()=>{});await pdfTask?.destroy().catch(()=>{});image?.close();}
}
