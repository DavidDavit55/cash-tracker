// Offline recovery drill. No network or deployed database access.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PGlite} from '../.release/budget-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
const folder=path.resolve(process.argv[2]);
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
const source=JSON.parse(fs.readFileSync(path.join(folder,'crm.json'),'utf8'));
const hash=v=>createHash('sha256').update(v).digest('hex');
assert.equal(hash(JSON.stringify(source.state)),manifest.stateSha256);
const db=new PGlite();
try{
 await db.exec('CREATE TABLE recovered_crm(revision integer,state jsonb); CREATE TABLE recovered_files(id text PRIMARY KEY,bytes bytea);');
 await db.query('INSERT INTO recovered_crm VALUES($1,$2)',[source.revision,JSON.stringify(source.state)]);
 for(const f of manifest.files){assert.match(f.id,/^[a-f0-9-]{36}$/);const bytes=fs.readFileSync(path.join(folder,f.id+'.bin'));assert.equal(bytes.length,f.size);assert.equal(hash(bytes),f.sha256);await db.query('INSERT INTO recovered_files VALUES($1,$2)',[f.id,bytes]);const restored=(await db.query('SELECT bytes FROM recovered_files WHERE id=$1',[f.id])).rows[0].bytes;assert.equal(hash(restored),f.sha256);}
 const recovered=(await db.query('SELECT * FROM recovered_crm')).rows[0];assert.deepEqual(recovered.state,source.state);assert.equal(recovered.revision,source.revision);
 console.log(JSON.stringify({result:'PASS',snapshot:path.basename(folder),revision:source.revision,clients:source.state.clients.length,files:manifest.files.length,offline:true,limitation:'CRM state and referenced files only; not full database, OAuth or current live recovery'}));
}finally{await db.close();}
