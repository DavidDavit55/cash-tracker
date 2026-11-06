import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
// Caller must explicitly supply a destination connection. No network, credentials,
// schema creation or automatic execution is performed by importing this module.
export async function restoreCrmIntoEmptyOwner({db,owner,snapshot,manifest,files}){
 if(hash(JSON.stringify(snapshot.state))!==manifest.stateSha256||!Array.isArray(snapshot.state?.clients)||snapshot.revision!==manifest.revision)throw Error('Invalid recovery state');
 const meta=new Map(),owners=new Map();
 function collect(v,clientId){
  if(!v||typeof v!=='object')return;
  if(v.storage==='staging-private'&&v.id){
   const previous=meta.get(v.id)||{};
   for(const field of ['sha256','name','mime','source'])if(previous[field]&&v[field]&&previous[field]!==v[field])throw Error('Conflicting file metadata');
   meta.set(v.id,{...previous,...Object.fromEntries(Object.entries(v).filter(([,value])=>value!==undefined&&value!==null&&value!==''))});
   if(clientId){const ids=owners.get(v.id)||new Set();ids.add(clientId);owners.set(v.id,ids);}
  }
  for(const x of Object.values(v))collect(x,clientId);
 }
 collect(snapshot.state);
 for(const client of snapshot.state.clients)collect(client,client.id);
 // Deleted clients remain archived in the state. Preserve their file ownership
 // without restoring them into the active client list.
 for(const entry of snapshot.state.deletedClients||[])if(entry?.client?.id)collect(entry.client,entry.client.id);
 if(meta.size!==manifest.files.length||new Set(manifest.files.map(f=>f.id)).size!==manifest.files.length||files.size!==meta.size)throw Error('Incomplete recovery files');
 for(const f of manifest.files){const bytes=files.get(f.id),m=meta.get(f.id);if(!m||!bytes||bytes.length!==f.size||hash(bytes)!==f.sha256||(m.sha256&&m.sha256!==f.sha256))throw Error('Invalid recovery file');if(owners.get(f.id)?.size!==1)throw Error('Ambiguous file owner');}
 // A pool must reserve one connection for the entire transaction.
 const connection=typeof db.connect==='function'?await db.connect():db;
 db=connection;
 try{
  await db.query('BEGIN');
  const user=await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[owner]);if(user.rows.length!==1)throw Error('Owner missing');
  if((await db.query('SELECT owner_id FROM operational_crm WHERE owner_id=$1',[owner])).rows.length||(await db.query('SELECT id FROM operational_crm_files WHERE owner_id=$1',[owner])).rows.length)throw Error('Destination is not empty');
  await db.query('INSERT INTO operational_crm(owner_id,revision,state) VALUES($1,$2,$3)',[owner,snapshot.revision,JSON.stringify(snapshot.state)]);
  for(const f of manifest.files){const m=meta.get(f.id),clientIds=owners.get(f.id);if(clientIds?.size!==1)throw Error('Ambiguous file owner');await db.query('INSERT INTO operational_crm_files(owner_id,id,client_id,name,source,mime,bytes,sha256,size) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[owner,f.id,[...clientIds][0],m.name,m.source||'legacy-unclassified',m.mime||'application/octet-stream',files.get(f.id),f.sha256,f.size]);}
  const row=(await db.query('SELECT state,revision FROM operational_crm WHERE owner_id=$1',[owner])).rows[0];
  // JSONB changes key order, so compare canonical values recursively.
  const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  if(JSON.stringify(canonical(row.state))!==JSON.stringify(canonical(snapshot.state))||row.revision!==snapshot.revision)throw Error('State verification failed');
  const restored=(await db.query('SELECT id,bytes FROM operational_crm_files WHERE owner_id=$1',[owner])).rows;
  if(restored.length!==files.size||restored.some(f=>hash(f.bytes)!==hash(files.get(f.id))))throw Error('File verification failed');
  await db.query('COMMIT');return {clients:snapshot.state.clients.length,archivedClients:(snapshot.state.deletedClients||[]).length,files:files.size,revision:snapshot.revision};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{connection.release?.();}
}
