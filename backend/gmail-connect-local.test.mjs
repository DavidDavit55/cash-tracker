import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizationUrl,createConnectionServer,REDIRECT,SCOPE} from './gmail-connect-local.mjs';
test('read-only scope, exact callback, state and PKCE',()=>{
 const u=new URL(authorizationUrl('test-id','test-state','test-verifier'));
 assert.equal(u.origin,'https://accounts.google.com');
 assert.equal(u.searchParams.get('scope'),SCOPE);
 assert.equal(u.searchParams.get('redirect_uri'),REDIRECT);
 assert.equal(u.searchParams.get('state'),'test-state');
 assert.equal(u.searchParams.get('code_challenge_method'),'S256');
 assert.equal(u.searchParams.get('access_type'),'online');
 assert(!u.searchParams.has('client_secret'));
});
test('invalid credentials rejected without echoing secret',()=>{
 assert.throws(()=>createConnectionServer({client_secret:'secret'}),/^Error: Invalid credential configuration$/);
});
test('startup does not make requests and generates distinct setup gates',()=>{
 let calls=0;const c={client_id:'test',client_secret:'test',project_id:'networth-crm'};
 const a=createConnectionServer(c,()=>{calls++;});const b=createConnectionServer(c);
 assert.notEqual(a.startUrl,b.startUrl);assert.equal(calls,0);
});
