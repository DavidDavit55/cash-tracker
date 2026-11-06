import test from 'node:test';
import assert from 'node:assert/strict';
import {taskLinkHash,resolveTaskLink} from '../.local-preview/workflow-home-model.js';
test('direct links resolve only current tasks in this account',()=>{
 const clients=[{id:'opaque-id',name:'Test',call:'done',products:[],decisions:[]}];
 const hash=taskLinkHash('opaque-id:info');
 assert.equal(resolveTaskLink(clients,hash).tab,'פרטים והרשאות');
 assert.equal(resolveTaskLink(clients,hash).clientId,'opaque-id');
 assert.equal(resolveTaskLink([],hash),null);
 assert.equal(resolveTaskLink(clients,'#task=%XX'),null);
 assert.equal(resolveTaskLink(clients,'#workflow-v2'),null);
 assert.equal(resolveTaskLink(clients,taskLinkHash('opaque-id:old')),null);
});
