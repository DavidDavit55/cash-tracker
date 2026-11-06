import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {localDatabase} from './budget-test-db.mjs';
import {operationalCrmSchema} from './src/routes/operationalCrm.js';
import {restoreCrmIntoEmptyOwner} from './src/services/crmRecovery.js';
const sha=x=>createHash('sha256').update(x).digest('hex');
const owner='11111111-1111-4111-8111-111111111111';
const fileId='22222222-2222-4222-8222-222222222222';
function fixture(){
 const bytes=Buffer.from('archived test evidence');
 const ref={id:fileId,storage:'staging-private',name:'archive.txt',sha256:sha(bytes)};
 const state={clients:[{id:'active',history:['keep']}],deletedClients:[{client:{id:'archived',reports:[{sourceFile:ref}],history:['keep archived']}}],unknown:{keep:true}};
 const snapshot={revision:7,state};
 const manifest={revision:7,stateSha256:sha(JSON.stringify(state)),files:[{id:fileId,sha256:sha(bytes),size:bytes.length}]};
 return {owner,snapshot,manifest,files:new Map([[fileId,bytes]])};
}
test('recovery retains archived ownership and content; rejects overwrite, corruption and ambiguity',async()=>{
 const {db,pool}=await localDatabase();
 try{
  await db.exec(operationalCrmSchema);
  await db.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,'test@example.test','Test','unused')",[owner]);
  const f=fixture();
  const bad=fixture();bad.files.set(fileId,Buffer.from('bad'));
  await assert.rejects(()=>restoreCrmIntoEmptyOwner({db:pool,...bad}),/Invalid recovery file/);
  const ambiguous=fixture();ambiguous.snapshot.state.clients[0].document=ambiguous.snapshot.state.deletedClients[0].client.reports[0].sourceFile;
  ambiguous.manifest.stateSha256=sha(JSON.stringify(ambiguous.snapshot.state));
  await assert.rejects(()=>restoreCrmIntoEmptyOwner({db:pool,...ambiguous}),/Ambiguous/);
  assert.equal((await db.query('SELECT * FROM operational_crm')).rows.length,0);
  let released=0;
  const reserved={query(){throw Error('Pool query outside reserved transaction');},connect:async()=>({...await pool.connect(),release(){released++;}})};
  assert.deepEqual(await restoreCrmIntoEmptyOwner({db:reserved,...f}),{clients:1,archivedClients:1,files:1,revision:7});
  assert.equal(released,1);
  const row=(await db.query('SELECT client_id,source,bytes FROM operational_crm_files')).rows[0];
  assert.equal(row.client_id,'archived');assert.equal(row.source,'legacy-unclassified');assert.equal(sha(row.bytes),sha(f.files.get(fileId)));
  assert.deepEqual((await db.query('SELECT state FROM operational_crm')).rows[0].state,f.snapshot.state);
  await assert.rejects(()=>restoreCrmIntoEmptyOwner({db:pool,...f}),/not empty/);
  await db.query('DELETE FROM operational_crm_files');await db.query('DELETE FROM operational_crm');
  const failing={connect:async()=>({query:(sql,args)=>sql.startsWith('INSERT INTO operational_crm_files')?Promise.reject(Error('Injected disk failure')):pool.query(sql,args),release(){}})};
  await assert.rejects(()=>restoreCrmIntoEmptyOwner({db:failing,...f}),/Injected/);
  assert.equal((await db.query('SELECT * FROM operational_crm')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM operational_crm_files')).rows.length,0);
 }finally{await db.close();}
});
