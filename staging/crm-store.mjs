// The same owner lock is used by Calendar, Tasks and reset. A sync can never
// acknowledge stale state while a whole-document CRM write is replacing it.
export function saveCrm({pool}) {return async(req,res)=>{
 const {revision,state}=req.body;
 if(!Number.isInteger(revision)||revision<0||!state||!Array.isArray(state.clients))return res.sendStatus(400);
 const db=await pool.connect();
 try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[req.user.id]);
  const current=(await db.query('SELECT revision FROM staging_crm WHERE owner_id=$1 FOR UPDATE',[req.user.id])).rows[0];
  if((current?.revision||0)!==revision){await db.query('ROLLBACK');return res.status(409).json({error:'conflict'});}
  const sql=current?'UPDATE staging_crm SET revision=revision+1,state=$2::jsonb WHERE owner_id=$1 RETURNING revision':'INSERT INTO staging_crm(owner_id,revision,state) VALUES($1,1,$2::jsonb) RETURNING revision';
  const result=await db.query(sql,[req.user.id,JSON.stringify(state)]);
  await db.query('COMMIT');res.json(result.rows[0]);
 }catch{await db.query('ROLLBACK');res.status(500).json({error:'השמירה נכשלה. הנתונים הקודמים נשמרו.'});}finally{db.release();}
};}
