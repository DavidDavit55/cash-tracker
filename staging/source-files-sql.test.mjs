// Independent SQL/bytea/recovery integration. Synthetic in-memory DB only; no server/network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PGlite} from '../.release/budget-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import {createFiles,filesSchema} from './files.mjs';

const owner='11111111-1111-4111-8111-111111111111',otherOwner='22222222-2222-4222-8222-222222222222';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const reply=()=>({code:200,headers:{},status(n){this.code=n;return this;},json(v){this.body=v;return this;},send(v){this.body=v;return this;},sendStatus(n){this.code=n;return this;},set(k,v){this.headers[k]=v;return this;}});
const upload=(bytes,{user=owner,client='client-a',name='מקור בדיקה.xml',source='maslaka'}={})=>({user:{id:user},query:{clientId:client,source},get:key=>key==='X-File-Name'?encodeURIComponent(name):undefined,body:bytes});
const download=(id,user=owner)=>({user:{id:user},params:{id}});

test('source archives persist real bytea; retries/cross-owner isolation and JSON+originals backup restore',async()=>{
 let db=new PGlite(),restored;
 try{
  await db.exec(`CREATE TABLE users(id uuid PRIMARY KEY);CREATE TABLE staging_crm(owner_id uuid PRIMARY KEY REFERENCES users(id),revision integer NOT NULL,state jsonb NOT NULL);${filesSchema}`);
  // Real SQL constraints and migrations are exercised, including repeat startup.
  await db.exec(filesSchema);
  await db.query('INSERT INTO users(id) VALUES($1),($2)',[owner,otherOwner]);
  const initial={clients:[{id:'client-a',name:'לקוח סינתטי בלבד',identity:'123456789',products:[],reports:[],events:[]},{id:'client-b',name:'תיק סינתטי נוסף',products:[],reports:[]}],selected:'client-a'};
  await db.query('INSERT INTO staging_crm(owner_id,revision,state) VALUES($1,1,$2::jsonb),($3,1,$4::jsonb)',[owner,JSON.stringify(initial),otherOwner,JSON.stringify({clients:[{id:'client-a',name:'Different owner'}]})]);
  const api=createFiles({pool:{query:(sql,args)=>db.query(sql,args)}});
  const xml=Buffer.from('<?xml version="1.0" encoding="UTF-8"?><Root>מידע סינתטי בלבד</Root>');
  // Deliberately exercise zeros and high bytes through bytea; format signature is synthetic.
  const binary=Buffer.from([0x50,0x4b,0x03,0x04,0x00,0xff,0xfe,0x80,0x01,0x7f,0x00]);
  const first=reply();await api.create(upload(xml),first);assert.equal(first.code,201);assert.equal(first.body.sha256,sha(xml));assert.equal(first.body.size,xml.length);assert.equal(first.body.storage,'staging-private');assert.equal(first.body.bytes,undefined);
  const archiveId=first.body.id;
  const duplicates=await Promise.all(Array.from({length:3},async(_,i)=>{const res=reply();await api.create(upload(xml,{name:`retry-${i}.xml`}),res);return res;}));
  assert.ok(duplicates.every(r=>r.code===201&&r.body.id===archiveId));assert.equal((await db.query('SELECT count(*)::int AS n FROM staging_crm_files')).rows[0].n,1);
  const sameBytesDifferentClient=reply();await api.create(upload(xml,{client:'client-b'}),sameBytesDifferentClient);assert.equal(sameBytesDifferentClient.code,201);assert.notEqual(sameBytesDifferentClient.body.id,archiveId);
  const binaryResponse=reply();await api.create(upload(binary,{name:'סינתטי.xlsx',source:'har_bituach'}),binaryResponse);assert.equal(binaryResponse.code,201);
  const row=(await db.query('SELECT bytes,size,sha256 FROM staging_crm_files WHERE owner_id=$1 AND id=$2',[owner,binaryResponse.body.id])).rows[0];assert.deepEqual(Buffer.from(row.bytes),binary);assert.equal(row.size,binary.length);assert.equal(row.sha256,sha(binary));
  const downloaded=reply();await api.read(download(binaryResponse.body.id),downloaded);assert.equal(downloaded.code,200);assert.deepEqual(Buffer.from(downloaded.body),binary);assert.equal(downloaded.headers['Cache-Control'],'no-store');assert.equal(downloaded.headers['X-Content-Type-Options'],'nosniff');assert.match(downloaded.headers['Content-Disposition'],/^attachment; filename\*=UTF-8''/);assert.match(downloaded.headers['Content-Security-Policy'],/sandbox/);
  const foreignRead=reply();await api.read(download(archiveId,otherOwner),foreignRead);assert.equal(foreignRead.code,404);assert.equal(foreignRead.body,undefined);
  const foreignCreate=reply();await api.create(upload(xml,{user:otherOwner,client:'client-b'}),foreignCreate);assert.equal(foreignCreate.code,404);
  const ownOther=reply();await api.create(upload(xml,{user:otherOwner}),ownOther);assert.equal(ownOther.code,201);assert.notEqual(ownOther.body.id,archiveId);
  const invalidId=reply();await api.read(download('../'+archiveId),invalidId);assert.equal(invalidId.code,404);
  const invalidFile=reply();await api.create(upload(xml,{name:'disguised.zip'}),invalidFile);assert.equal(invalidFile.code,400);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM staging_crm_files')).rows[0].n,4);
  const linked=structuredClone(initial);linked.clients[0].reports=[{id:'report',source:'maslaka',fingerprint:sha(xml),sourceFile:first.body},{id:'har',source:'har_bituach',fingerprint:sha(binary),sourceFile:binaryResponse.body}];linked.clients[0].events=[{id:'audit',at:'2026-09-30T12:00:00Z',text:'קליטת מקור סינתטי'}];
  await db.query('UPDATE staging_crm SET state=$2::jsonb,revision=revision+1 WHERE owner_id=$1',[owner,JSON.stringify(linked)]);
  const expected=(await db.query('SELECT state,revision FROM staging_crm WHERE owner_id=$1',[owner])).rows[0];
  // Use the installed PGlite dumpDataDir/loadDataDir API; restore into a new instance.
  const backup=await db.dumpDataDir('none');assert.ok(backup instanceof Blob);assert.ok(backup.size>xml.length+binary.length);
  await db.close();db=null;restored=new PGlite({loadDataDir:backup});await restored.waitReady;
  assert.deepEqual((await restored.query('SELECT state,revision FROM staging_crm WHERE owner_id=$1',[owner])).rows[0],expected);
  assert.equal((await restored.query('SELECT count(*)::int AS n FROM staging_crm_files')).rows[0].n,4);
  const recovered=createFiles({pool:{query:(sql,args)=>restored.query(sql,args)}});
  for(const [id,bytes] of [[archiveId,xml],[binaryResponse.body.id,binary]]){const res=reply();await recovered.read(download(id),res);assert.equal(res.code,200);assert.deepEqual(Buffer.from(res.body),bytes);assert.equal(sha(Buffer.from(res.body)),sha(bytes));}
  const stillPrivate=reply();await recovered.read(download(archiveId,otherOwner),stillPrivate);assert.equal(stillPrivate.code,404);
  const retryAfterRestore=reply();await recovered.create(upload(xml),retryAfterRestore);assert.equal(retryAfterRestore.code,201);assert.equal(retryAfterRestore.body.id,archiveId);assert.equal((await restored.query('SELECT count(*)::int AS n FROM staging_crm_files')).rows[0].n,4);
  // Recoverably deleted client sources remain retrievable by their owner, not another owner.
  await restored.query('UPDATE staging_crm SET state=$2::jsonb WHERE owner_id=$1',[owner,JSON.stringify({clients:[],deletedClients:linked.clients,selected:null})]);
  const archived=reply();await recovered.read(download(archiveId),archived);assert.equal(archived.code,200);assert.deepEqual(Buffer.from(archived.body),xml);
  const noNewUpload=reply();await recovered.create(upload(xml),noNewUpload);assert.equal(noNewUpload.code,404);
 }finally{if(db&&!db.closed)await db.close();if(restored&&!restored.closed)await restored.close();}
});
