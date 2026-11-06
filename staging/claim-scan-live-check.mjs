import fs from 'node:fs';
import assert from 'node:assert/strict';
const base='https://networth-staging-staging.up.railway.app';
const config=JSON.parse(fs.readFileSync(new URL('../.staging-private/credentials.json',import.meta.url),'utf8'));
const unlock=await fetch(base+'/__staging/unlock',{method:'POST',redirect:'manual',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({key:config.STAGING_ACCESS_KEY})});
assert.equal(unlock.status,302);
const cookie=unlock.headers.get('set-cookie').split(';')[0];
for(const name of ['worker.min.js','heb.traineddata.gz','eng.traineddata.gz']){
 const response=await fetch(base+'/claim-scan/'+name,{headers:{Cookie:cookie},signal:AbortSignal.timeout(60000)});
 assert.equal(response.status,200);
 assert.ok(!response.headers.get('content-type')?.includes('text/html'));
 const bytes=await response.arrayBuffer();assert.ok(bytes.byteLength>10000);
 console.log(JSON.stringify({asset:name,bytes:bytes.byteLength,status:'PASS'}));
}
