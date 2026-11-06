import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function claimScanAssets(){
 const base=path.dirname(fileURLToPath(import.meta.url));
 let serving=false;
 const files=new Map([['worker.min.js','tesseract.js/dist/worker.min.js']]);
 for(const name of fs.readdirSync(path.join(base,'node_modules/tesseract.js-core')))if(name.endsWith('.wasm.js')||name.endsWith('.wasm'))files.set(name,'tesseract.js-core/'+name);
 for(const lang of ['heb','eng'])files.set(lang+'.traineddata.gz',`@tesseract.js-data/${lang}/4.0.0/${lang}.traineddata.gz`);
 return {name:'private-claim-scan-assets',configResolved(config){serving=config.command==='serve'},buildStart(){if(serving||process.env.VITE_APP_ENV!=='staging')return;for(const [name,source] of files)this.emitFile({type:'asset',fileName:'claim-scan/'+name,source:fs.readFileSync(path.join(base,'node_modules',source))})},configureServer(server){server.middlewares.use((req,res,next)=>{const name=req.url?.split('?')[0]?.replace(/^\/claim-scan\//,'');if(!req.url?.startsWith('/claim-scan/')||!files.has(name))return next();res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.end(fs.readFileSync(path.join(base,'node_modules',files.get(name))))})}};
}
