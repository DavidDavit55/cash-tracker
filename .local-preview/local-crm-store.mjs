import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';

export function openStore(directory){
 mkdirSync(directory,{recursive:true});
 const db=new DatabaseSync(path.join(directory,'crm.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS snapshots (revision INTEGER PRIMARY KEY, body TEXT NOT NULL, saved_at TEXT NOT NULL)');
 const read=()=>{const row=db.prepare('SELECT * FROM snapshots ORDER BY revision DESC LIMIT 1').get();return row?{revision:row.revision,state:JSON.parse(row.body),savedAt:row.saved_at}:{revision:0,state:null};};
 return {read,close:()=>db.close(),save(expected,state){
  if(!Number.isSafeInteger(expected)||expected<0||!state||!Array.isArray(state.clients)||state.clients.some(c=>!c||typeof c.id!=='string'||!Array.isArray(c.events)||!Array.isArray(c.products)||!Array.isArray(c.decisions)||!Array.isArray(c.appointments)||!Array.isArray(c.messages)||!Array.isArray(c.reports))||new Set(state.clients.map(c=>c.id)).size!==state.clients.length)throw Object.assign(Error('Invalid state'),{status:400});
  const body=JSON.stringify(state);if(Buffer.byteLength(body)>32*1024*1024)throw Object.assign(Error('Too large'),{status:413});
  db.exec('BEGIN IMMEDIATE');
  try{const current=read();if(current.revision!==expected)throw Object.assign(Error('Conflict'),{status:409});
   db.prepare('INSERT INTO snapshots VALUES (?, ?, ?)').run(expected+1,body,new Date().toISOString());
   db.prepare('DELETE FROM snapshots WHERE revision < ?').run(Math.max(1,expected-8));
   db.exec('COMMIT');return read();
  }catch(e){db.exec('ROLLBACK');throw e;}
 }};
}
export function createStoreHandler(store,port=5208){
 const token=randomBytes(32).toString('hex');
 const hosts=new Set(['127.0.0.1:'+port,'localhost:'+port]);
 return async(req,res)=>{
  if(!req.url?.startsWith('/sandbox-store'))return false;
  const reply=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
  if(req.url!=='/sandbox-store'||!hosts.has(req.headers.host)||req.headers['x-sandbox-request']!=='1'){reply(403,{error:'Local sandbox only'});return true;}
  if(req.headers.origin&&!hosts.has(req.headers.origin.replace(/^http:\/\//,''))){reply(403,{error:'Origin rejected'});return true;}
  try{
   if(req.method==='GET'){reply(200,{...store.read(),token});return true;}
   if(req.method!=='PUT'){reply(405,{error:'Method not allowed'});return true;}
   if(!req.headers.origin||req.headers['x-sandbox-token']!==token||!req.headers['content-type']?.startsWith('application/json')){reply(403,{error:'Request rejected'});return true;}
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>33*1024*1024){reply(413,{error:'State too large'});return true;}chunks.push(chunk);}
   let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{reply(400,{error:'Invalid JSON'});return true;}
   reply(200,store.save(input.revision,input.state));
  }catch(e){reply(e.status||500,{error:e.status===409?'התיק השתנה בלשונית אחרת. יש לטעון את גרסת השרת לפני המשך.':'השמירה בשרת לא הושלמה.'});}
  return true;
 };
}
