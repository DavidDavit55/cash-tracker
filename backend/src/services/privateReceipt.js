import path from 'node:path';
export function receiptHandler(pool, uploadsDir) {
 return async (req,res,next)=>{
  try {
   if(!/^[0-9a-f-]{36}$/i.test(req.params.id))return res.sendStatus(404);
   const {rows}=await pool.query('SELECT receipt_url FROM expenses WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]);
   const url=rows[0]?.receipt_url;
   if(typeof url!=='string'||!/^\/uploads\/[a-zA-Z0-9._-]+$/.test(url))return res.sendStatus(404);
   const name=url.slice('/uploads/'.length);
   if(name.startsWith('.'))return res.sendStatus(404);
   res.setHeader('Cache-Control','private, no-store');
   res.setHeader('X-Content-Type-Options','nosniff');
   res.download(path.join(uploadsDir,name),name,err=>{if(err&&!res.headersSent)res.sendStatus(err.code==='ENOENT'?404:500);});
  } catch(error){next(error);}
 };
}
