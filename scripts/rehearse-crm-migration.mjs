// Offline-only: real staging backup -> ephemeral local PostgreSQL. No deployment.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {localDatabase} from '../backend/budget-test-db.mjs';
import {operationalCrmSchema} from '../backend/src/routes/operationalCrm.js';
import {restoreCrmIntoEmptyOwner} from '../backend/src/services/crmRecovery.js';
import {operationalProjection} from '../staging/tasks.mjs';
import {homeTasks} from '../.local-preview/workflow-home-model.js';
const dir=path.resolve(process.argv[2]),snapshot=JSON.parse(fs.readFileSync(path.join(dir,'crm.json'))),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
const files=new Map(manifest.files.map(f=>{assert.match(f.id,/^[a-f0-9-]{36}$/);return [f.id,fs.readFileSync(path.join(dir,f.id+'.bin'))];}));
const {db,pool}=await localDatabase(),owner='11111111-1111-4111-8111-111111111111';
try{await db.exec(operationalCrmSchema);await db.query("INSERT INTO users(id,email,name,password_hash) VALUES($1,'recovery@example.test','Recovery','unused')",[owner]);
 const result=await restoreCrmIntoEmptyOwner({db:pool,owner,snapshot,manifest,files});
 const restored=(await db.query('SELECT state FROM operational_crm WHERE owner_id=$1',[owner])).rows[0].state;
 // Execute the existing workflow model, not a replacement approximation.
 assert.deepEqual(homeTasks(restored.clients),homeTasks(snapshot.state.clients));
 assert.deepEqual(operationalProjection(restored),operationalProjection(snapshot.state));
 await assert.rejects(()=>restoreCrmIntoEmptyOwner({db:pool,owner,snapshot,manifest,files}),/not empty/);
 console.log(JSON.stringify({result:'PASS',...result,repeatImport:'refused',workflowProjection:'unchanged',currentTasks:homeTasks(restored.clients).length,remoteWrites:0}));
}catch(error){console.error(JSON.stringify({result:'FAIL',message:error.message,remoteWrites:0}));process.exitCode=1;}finally{await db.close();}
