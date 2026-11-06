// Private source archives. Binary content stays in staging Postgres, never a public URL.
import {createHash,randomUUID} from 'node:crypto';
export const MAX_SOURCE_BYTES=30*1024*1024;
export const filesSchema=`CREATE TABLE IF NOT EXISTS staging_crm_files(
 owner_id uuid NOT NULL REFERENCES users(id),client_id text NOT NULL,id uuid NOT NULL,
 source text NOT NULL,name text NOT NULL,mime text NOT NULL,bytes bytea NOT NULL,
 size integer NOT NULL,sha256 text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,id),UNIQUE(owner_id,client_id,source,sha256));`;
const idOK=value=>typeof value==='string'&&value.length>0&&value.length<=200&&!/[\x00-\x1f]/.test(value);
export function sourceMetadata({name,source,bytes}) {
 if(typeof name!=='string'||name.length>240||/[\\/\x00-\x1f]/.test(name)||!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX_SOURCE_BYTES)throw Error('file_invalid');
 const ext=name.split('.').at(-1).toLowerCase();
 if(!(source==='maslaka'?['zip','xml']:source==='har_bituach'?['xlsx','xls']:source==='company_email'?['eml']:source==='company_pdf'?['pdf']:[]).includes(ext))throw Error('file_invalid');
 if(ext==='pdf'&&!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('file_invalid');
 if(ext==='eml'&&!/^(?:[\w-]+:[^\r\n]*\r?\n|[ \t]+[^\r\n]*\r?\n)+\r?\n/.test(bytes.subarray(0,65536).toString('utf8')))throw Error('file_invalid');
 const zip=bytes[0]===0x50&&bytes[1]===0x4b,ole=bytes.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex'));
 const xml=/^(?:\uFEFF)?\s*</.test(bytes.subarray(0,300).toString('utf8'))||bytes.subarray(0,2).equals(Buffer.from([0xff,0xfe]));
 if((['zip','xlsx'].includes(ext)&&!zip)||(ext==='xls'&&!ole)||(ext==='xml'&&!xml))throw Error('file_invalid');
 return {name,source,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),mime:{eml:'message/rfc822',pdf:'application/pdf',zip:'application/zip',xml:'application/xml',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xls:'application/vnd.ms-excel'}[ext]};
}
const response=row=>({id:row.id,name:row.name,source:row.source,size:row.size,sha256:row.sha256,mime:row.mime,createdAt:row.created_at,storage:'staging-private'});
export function createFiles({pool}) {
 const create=async(req,res)=>{try{
  const owner=req.user.id,clientId=req.query.clientId;
  if(!idOK(clientId))return res.status(400).json({error:'תיק לקוח לא תקין.'});
  let name;try{name=decodeURIComponent(req.get('X-File-Name')||'');}catch{return res.status(400).json({error:'שם קובץ לא תקין.'});}
  const meta=sourceMetadata({name,source:req.query.source,bytes:req.body});
  const state=(await pool.query('SELECT state FROM staging_crm WHERE owner_id=$1',[owner])).rows[0]?.state;
  if(!state?.clients?.some(c=>c.id===clientId))return res.status(404).json({error:'תיק הלקוח לא נמצא. יש לשמור את הליד לפני העלאה.'});
  const {rows}=await pool.query(`INSERT INTO staging_crm_files(owner_id,client_id,id,source,name,mime,bytes,size,sha256)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(owner_id,client_id,source,sha256)
   DO UPDATE SET sha256=EXCLUDED.sha256 RETURNING id,name,source,mime,size,sha256,created_at`,
   [owner,clientId,randomUUID(),meta.source,meta.name,meta.mime,req.body,meta.size,meta.sha256]);
  res.status(201).json(response(rows[0]));
 }catch(e){res.status(e.message==='file_invalid'?400:500).json({error:e.message==='file_invalid'?'קובץ מקור לא תקין או גדול מ־30MB.':'שמירת קובץ המקור נכשלה. הקליטה לא הושלמה; אפשר לנסות שוב.'});}};
 const read=async(req,res)=>{try{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id||''))return res.sendStatus(404);
  const row=(await pool.query('SELECT client_id,name,mime,bytes,sha256 FROM staging_crm_files WHERE owner_id=$1 AND id=$2',[req.user.id,req.params.id])).rows[0];
  if(!row)return res.sendStatus(404);
  // Sources belonging to recoverably deleted cases remain owner-accessible for recovery.
  res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');res.set('Content-Security-Policy',"default-src 'none'; sandbox");
  res.set('Content-Type',row.mime);res.set('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(row.name));
  res.send(row.bytes);
 }catch{res.status(500).json({error:'לא ניתן להוריד את קובץ המקור כעת.'});}};
 return {create,read};
}
