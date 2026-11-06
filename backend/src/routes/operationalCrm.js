// Production owner-only CRM core. Disabled until explicit configuration and
// migration; never creates demo users or initializes a production database.
import {Router} from 'express';
export const operationalCrmSchema=`
CREATE TABLE IF NOT EXISTS operational_crm(owner_id uuid PRIMARY KEY REFERENCES users(id),revision integer NOT NULL,state jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS operational_crm_files(owner_id uuid NOT NULL REFERENCES users(id),id uuid NOT NULL,client_id text NOT NULL,name text NOT NULL,source text NOT NULL,mime text NOT NULL,bytes bytea NOT NULL,sha256 text NOT NULL,size integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(owner_id,id),UNIQUE(owner_id,client_id,source,sha256));`;
export function createOperationalCrm({pool,authenticate,env=process.env}){
 const router=Router();
 router.use((req,res,next)=>{res.set('Cache-Control','no-store');if(env.CRM_ENABLED!=='true')return res.sendStatus(404);next();});
 router.use(authenticate,async(req,res,next)=>{
  if(!env.CRM_OWNER_ID||!env.ADMIN_EMAIL||req.user.id!==env.CRM_OWNER_ID)return res.sendStatus(403);
  try{const {rows}=await pool.query('SELECT id FROM users WHERE id=$1 AND email=$2',[req.user.id,env.ADMIN_EMAIL]);if(rows.length!==1)return res.sendStatus(403);next();}catch{return res.sendStatus(503);}
 });
 router.get('/state',async(req,res)=>{try{const {rows}=await pool.query('SELECT revision,state FROM operational_crm WHERE owner_id=$1',[req.user.id]);if(!rows.length)return res.status(503).json({error:'CRM migration has not been verified'});res.json(rows[0]);}catch{res.sendStatus(503);}});
 router.put('/state',async(req,res)=>{
  const {revision,state}=req.body||{};
  if(!Number.isInteger(revision)||revision<0||!Array.isArray(state?.clients))return res.sendStatus(400);
  const ids=state.clients.map(c=>c?.id);if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)return res.sendStatus(400);
  let db;
  try{db=await pool.connect();}catch{return res.sendStatus(503);}
  try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[req.user.id]);
   const current=(await db.query('SELECT revision FROM operational_crm WHERE owner_id=$1 FOR UPDATE',[req.user.id])).rows[0];
   if(!current||current.revision!==revision){await db.query('ROLLBACK');return res.sendStatus(409);}
   const {rows}=await db.query('UPDATE operational_crm SET revision=revision+1,state=$2::jsonb WHERE owner_id=$1 RETURNING revision',[req.user.id,JSON.stringify(state)]);
   await db.query('COMMIT');res.json(rows[0]);
  }catch{await db.query('ROLLBACK');res.sendStatus(500);}finally{db.release();}
 });
 router.get('/files/:id',async(req,res)=>{try{
  if(!/^[a-f0-9-]{36}$/i.test(req.params.id))return res.sendStatus(404);
  const {rows}=await pool.query('SELECT name,mime,bytes FROM operational_crm_files WHERE owner_id=$1 AND id=$2',[req.user.id,req.params.id]);if(!rows.length)return res.sendStatus(404);
  const f=rows[0];res.set('Content-Security-Policy',"default-src 'none'; sandbox");res.set('X-Content-Type-Options','nosniff');res.set('Content-Type','application/octet-stream');res.set('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(f.name));res.send(f.bytes);
 }catch{res.sendStatus(500);}});
 // Integration activation is deliberately separate from persistence.
 router.use((_req,res)=>res.status(503).json({error:'This CRM capability has not been activated for production'}));
 return router;
}
