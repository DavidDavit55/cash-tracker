import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshTasksToken} from './tasks.mjs';
test('refresh errors are actionable and never expose Google response secrets',async()=>{
 for(const [code,expected] of [['invalid_grant','reauthorize'],['invalid_client','oauth_configuration'],['unknown','token_refresh_failed']]){
  await assert.rejects(refreshTasksToken({},'secret',async()=>new Response(JSON.stringify({error:code,error_description:'private-secret'}),{status:400})),e=>e.message===expected&&!e.message.includes('private-secret'));
 }
 await assert.rejects(refreshTasksToken({},'',()=>{throw Error('must not call')}),/reauthorize/);
 assert.equal((await refreshTasksToken({},'token',async()=>new Response(JSON.stringify({access_token:'ok'})))).access_token,'ok');
});
