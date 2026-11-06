import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {scanKnownPrivateValues} from './scan-known-private-values.mjs';
test('detects known secrets and archived identities without disclosing values',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'networth-private-scan-'));
 try{const artifact=path.join(root,'build');fs.mkdirSync(artifact);const env=path.join(root,'input.env'),crm=path.join(root,'crm.json');
 fs.writeFileSync(env,'JWT_SECRET=synthetic-long-test-secret');fs.writeFileSync(crm,JSON.stringify({state:{clients:[],deletedClients:[{client:{email:'archived@example.test'}}]}}));
 fs.writeFileSync(path.join(artifact,'app.js'),'safe javascript');assert.equal(scanKnownPrivateValues({artifact,envFiles:[env],crmFiles:[crm]}).findings.length,0);
 fs.writeFileSync(path.join(artifact,'app.js'),'synthetic-long-test-secret archived@example.test');const result=scanKnownPrivateValues({artifact,envFiles:[env],crmFiles:[crm]});assert.equal(result.findings.length,1);assert.doesNotMatch(JSON.stringify(result),/synthetic-long|archived@example/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
