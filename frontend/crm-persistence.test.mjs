import test from 'node:test';
import assert from 'node:assert/strict';
import {createCrmPersistence} from './src/lib/crmPersistence.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('serializes saves, coalesces queued states, acknowledges callbacks only after saving',async()=>{
 const calls=[],done=[],status=[];let release;
 const writer=createCrmPersistence({revision:4,onStatus:s=>status.push(s),save:body=>{calls.push(body);return new Promise(r=>{release=r;});}});
 const first={clients:[{id:'1'}]};writer.persist(first,()=>done.push(1));first.clients[0].id='mutated';
 writer.persist({clients:[{id:'2'}]},()=>done.push(2));writer.persist({clients:[{id:'3'}]},()=>done.push(3));
 assert.equal(calls.length,1);assert.equal(calls[0].state.clients[0].id,'1');assert.deepEqual(done,[]);
 release({revision:5});await tick();assert.deepEqual(done,[1]);assert.equal(calls[1].revision,5);assert.equal(calls[1].state.clients[0].id,'3');
 release({revision:6});await tick();assert.deepEqual(done,[1,2,3]);assert.equal(writer.pending,null);assert.equal(writer.revision,6);assert.equal(status.at(-1).saving,false);
});
for(const failure of [Object.assign(Error('conflict'),{response:{status:409}}),Error('lost response')])test('retains latest draft and freezes on '+failure.message,async()=>{
 let reject,calls=0,callbacks=0;
 const writer=createCrmPersistence({revision:7,save:()=>{calls++;return new Promise((_,r)=>{reject=r;});}});
 writer.persist({clients:[{id:'first'}]},()=>callbacks++);writer.persist({clients:[{id:'last'}]},()=>callbacks++);
 reject(failure);await tick();assert.equal(writer.failed,true);assert.equal(writer.pending.clients[0].id,'last');assert.equal(callbacks,0);
 assert.equal(writer.persist({clients:[]}),false);assert.equal(calls,1);assert.equal(writer.revision,7);
});
test('invalid acknowledgement never reports success',async()=>{
 const writer=createCrmPersistence({revision:3,save:async()=>({revision:3})});let done=false;writer.persist({clients:[]},()=>{done=true;});await tick();assert.equal(done,false);assert.equal(writer.failed,true);assert.ok(writer.pending);
});
test('saved callback can enqueue the next change without losing it',async()=>{
 const calls=[];const writer=createCrmPersistence({revision:0,save:async body=>{calls.push(body);return {revision:body.revision+1};}});
 writer.persist({clients:[{id:'one'}]},()=>writer.persist({clients:[{id:'two'}]}));await tick();assert.equal(calls.length,2);assert.equal(writer.revision,2);assert.equal(writer.pending,null);
});
