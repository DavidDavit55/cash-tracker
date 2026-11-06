import assert from 'node:assert/strict';
import {createPublicCatalogueHandler} from './public-fund-catalogue.mjs';
let calls=0;
const handler=createPublicCatalogueHandler(async(type,signal)=>{calls++;assert.equal(type,'pension');assert.ok(signal);return [{id:'1',name:'מסלול בדיקה',manager:'גוף בדיקה',reportPeriod:'202608',secret:'not returned'}];});
async function request(url,method='GET',route=handler){
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=JSON.parse(v);}};
 const handled=await route({url,method,headers:{cookie:'must not forward'}},res);
 return {handled,...res};
}
for(const url of ['/preview-catalogue?type=other','/preview-catalogue?type=pension&identity=private','/preview-catalogue?type=pension&type=gemel','/preview-catalogue?url=https://example.com'])assert.equal((await request(url)).statusCode,400);
assert.equal((await request('/preview-catalogue?type=pension','POST')).statusCode,405);
assert.equal(calls,0);
assert.equal((await request('/other')).handled,false);
const ok=await request('/preview-catalogue?type=pension');assert.equal(ok.statusCode,200);assert.equal(ok.body.rows[0].secret,undefined);
await request('/preview-catalogue?type=pension');assert.equal(calls,1);
const broken=createPublicCatalogueHandler(async()=>{throw Error('private upstream details');});
const failed=await request('/preview-catalogue?type=pension','GET',broken);assert.equal(failed.statusCode,502);assert.ok(!JSON.stringify(failed.body).includes('private'));
console.log('PASS: fixed catalogue types, extra data rejected, GET only, response allowlist, cache, safe upstream failure');
