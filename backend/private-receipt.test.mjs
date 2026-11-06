import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptHandler} from './src/services/privateReceipt.js';
const id='12345678-1234-1234-1234-123456789012';
async function run(url){let sent,download,params;const headers={};await receiptHandler({query:async(sql,p)=>{assert.match(sql,/AND user_id=\$2/);params=p;return {rows:url?[{receipt_url:url}]:[]};}},'uploads')({params:{id},user:{id:'owner'}},{sendStatus:s=>sent=s,setHeader:(k,v)=>headers[k]=v,download:(p,n)=>download=n},e=>{throw e});return {sent,download,params,headers};}
test('owner receipt is attachment and never cached',async()=>{const r=await run('/uploads/123-receipt.png');assert.equal(r.download,'123-receipt.png');assert.deepEqual(r.params,[id,'owner']);assert.equal(r.headers['Cache-Control'],'private, no-store');});
test('unowned or nonexistent receipt is hidden',async()=>assert.equal((await run(null)).sent,404));
test('path traversal and temporary uploads are rejected',async()=>{for(const p of ['/uploads/../secret','/uploads/tmp/data','/uploads/.env','https://example.com/test'])assert.equal((await run(p)).sent,404);});
