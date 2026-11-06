// Read-only: verify the private gateway and real public catalogue response.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base='https://networth-staging-staging.up.railway.app';
const secrets=JSON.parse(fs.readFileSync(new URL('../.staging-private/credentials.json',import.meta.url),'utf8'));
assert.equal((await fetch(base+'/preview-catalogue?type=pension')).status,401);
const unlock=await fetch(base+'/__staging/unlock',{method:'POST',redirect:'manual',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({key:secrets.STAGING_ACCESS_KEY})});
assert.equal(unlock.status,302);
const Cookie=unlock.headers.get('set-cookie').split(';')[0];
const html=await (await fetch(base+'/admin/crm',{headers:{Cookie}})).text();
const main=html.match(/src="([^"]+\/index-[^"]+\.js)"/)[1];
const js=await (await fetch(base+main,{headers:{Cookie}})).text();
const chunk=js.match(/(StagingCrm-[\w-]+\.js)/)[1];
const crm=await (await fetch(base+'/assets/'+chunk,{headers:{Cookie}})).text();
assert.ok(/preview-catalogue.{0,160}credentials:["'`]same-origin["'`]/.test(crm),'live catalogue must use same-origin credentials');
console.log('Live bundle: same-origin catalogue credentials verified');
for(const type of ['pension','gemel']){
 const r=await fetch(base+'/preview-catalogue?type='+type,{headers:{Cookie},signal:AbortSignal.timeout(25000)});
 assert.equal(r.status,200);const data=await r.json();assert.ok(data.rows.length>0);assert.ok(data.rows.every(row=>row.id&&row.name));console.log(type+': '+data.rows.length+' public tracks loaded');
}
