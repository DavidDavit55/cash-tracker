// Explicitly local-only harness for the real CRM persistence router and UI.
// Does not load .env, cloud credentials, email/calendar modules or production DB.
import express from 'express';
import {randomBytes} from 'node:crypto';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PGlite} from '../.release/budget-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import {createServer} from '../frontend/node_modules/vite/dist/node/index.js';
import react from '../frontend/node_modules/@vitejs/plugin-react/dist/index.js';
import {createOperationalCrm,operationalCrmSchema} from './src/routes/operationalCrm.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=4201,origin=`http://127.0.0.1:${port}`;
const owner='11111111-1111-4111-8111-111111111111',session=randomBytes(32).toString('hex');
const directory=path.join(root,'.release','crm-connected-review');
await mkdir(directory,{recursive:true});
const db=new PGlite(path.join(directory,'database'));
await db.exec('CREATE TABLE IF NOT EXISTS users(id uuid PRIMARY KEY,email text UNIQUE NOT NULL);'+operationalCrmSchema);
await db.query('INSERT INTO users VALUES($1,$2) ON CONFLICT DO NOTHING',[owner,'review@example.test']);
if(!(await db.query('SELECT owner_id FROM operational_crm WHERE owner_id=$1',[owner])).rows.length){
 const backup=process.argv[2];
 if(!backup)throw Error('Provide an existing local CRM snapshot. Never seed from production.');
 const snapshot=JSON.parse(await readFile(path.resolve(backup),'utf8'));
 if(!Number.isInteger(snapshot.revision)||!Array.isArray(snapshot.state?.clients))throw Error('Invalid snapshot');
 await db.query('INSERT INTO operational_crm VALUES($1,$2,$3)',[owner,snapshot.revision,JSON.stringify(snapshot.state)]);
}
// PGlite runs in one process; serialize transactions explicitly. The production
// router still uses PostgreSQL advisory locks in the real deployment.
let tail=Promise.resolve();
const pool={query:(sql,p)=>db.query(sql,p),connect:async()=>{
 const previous=tail;let unlock;tail=new Promise(resolve=>{unlock=resolve;});await previous;
 return {query:(sql,p)=>sql.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):db.query(sql,p),release:unlock};
}};
const app=express();app.disable('x-powered-by');
app.use((req,res,next)=>{
 if(req.headers.host!==`127.0.0.1:${port}`)return res.sendStatus(403);
 if(req.headers.origin&&req.headers.origin!==origin)return res.sendStatus(403);
 if(req.headers['sec-fetch-site']==='cross-site')return res.sendStatus(403);
 res.set('Cache-Control','no-store');
 res.set('Content-Security-Policy',`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:${port}; frame-src 'self' blob:; frame-ancestors 'none'; form-action 'none'; object-src 'none'`);
 next();
});
app.use(express.json({limit:'30mb'}));
app.post('/api/review-session',(_req,res)=>{res.set('Set-Cookie',`crm_review=${session}; HttpOnly; SameSite=Strict; Path=/`);res.json({localOnly:true});});
const authenticate=(req,res,next)=>{if(!req.headers.cookie?.split(';').some(x=>x.trim()===`crm_review=${session}`))return res.sendStatus(401);req.user={id:owner};next();};
app.use('/api/crm',createOperationalCrm({pool,authenticate,env:{CRM_ENABLED:'true',CRM_OWNER_ID:owner,ADMIN_EMAIL:'review@example.test'}}));
app.use('/api',(_req,res)=>res.status(403).json({error:'External integrations are disabled in local review'}));
app.get('/preview-catalogue',(_req,res)=>res.status(503).json({error:'הקטלוג החיצוני לא מופעל בבדיקה המקומית'}));
const vite=await createServer({configFile:false,root:path.join(root,'frontend'),envDir:path.join(directory,'no-env'),resolve:{dedupe:['react','react-dom']},plugins:[react()],server:{middlewareMode:true,hmr:false,fs:{allow:[path.join(root,'frontend'),path.join(root,'.local-preview')],deny:['**/.env*','**/.staging-private/**','**/.release/**','**/*.pem','**/*.key']}},appType:'spa'});
app.use((req,_res,next)=>{if(req.path==='/'||req.path==='/admin/crm')req.url='/crm-review.html';next();});
app.use(vite.middlewares);
const server=app.listen(port,'127.0.0.1',()=>console.log(`Local review ready: ${origin}/admin/crm. External integrations disabled.`));
async function close(){server.close();await vite.close();await db.close();process.exit();}
process.on('SIGINT',close);process.on('SIGTERM',close);
