import {defineConfig,mergeConfig} from 'vite';
import base from './vite.config.js';
import {readFile} from 'node:fs/promises';
const files={'/maslaka.zip':'C:/Users/david/Downloads/מסלקה_ביילה אהרמן.zip','/insurance.xlsx':'C:/Users/david/Downloads/HbResults-2026-09-19_10-39-16-PM.xlsx'};
export default defineConfig(env=>mergeConfig(base(env),{server:{host:'127.0.0.1',port:4186,strictPort:true},plugins:[{name:'local-review-named-inputs',apply:'serve',configureServer(server){server.middlewares.use('/__review-input',async(req,res)=>{if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||!files[req.url]){res.statusCode=404;res.end();return;}try{const body=await readFile(files[req.url]);res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/octet-stream');res.end(body);}catch{res.statusCode=404;res.end();}});}}]}));
