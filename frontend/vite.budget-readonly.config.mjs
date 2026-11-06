import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
export default defineConfig({envDir:'.preview-no-env',plugins:[react(),{name:'readonly-snapshot',configureServer(server){server.middlewares.use((req,res,next)=>{
 if(req.method!=='GET'||req.url.startsWith('/api/')){res.statusCode=403;res.end('Read only');return;}
 if(req.url==='/private-budget-snapshot'){
  if(req.headers.host!=='127.0.0.1:4200'||(req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))){res.statusCode=403;res.end();return;}
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(new URL('../.staging-private/october-preview.json',import.meta.url)));return;
 }next();
});}}],server:{host:'127.0.0.1',port:4200,strictPort:true,cors:false,headers:{'Content-Security-Policy':"connect-src 'self' ws://127.0.0.1:4200; form-action 'none'; object-src 'none'"}}});
