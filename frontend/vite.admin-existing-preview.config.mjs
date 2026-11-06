import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
 envDir:'.preview-no-env',
 resolve:{dedupe:['react','react-dom']},
 plugins:[react(),{name:'preview-no-api',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url.startsWith('/api/')){res.statusCode=403;res.end('Preview: API disabled');return;}next();});}}],
 server:{host:'127.0.0.1',port:4199,strictPort:true,headers:{'Content-Security-Policy':"connect-src 'self' ws://127.0.0.1:4199; form-action 'none'; object-src 'none'"}}
});
