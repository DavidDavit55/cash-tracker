import test from 'node:test';
import assert from 'node:assert/strict';
import {gmailLink} from './src/lib/gmailLink.js';
test('uses original Gmail ID and explicit mailbox, not CRM UUID',()=>{
 for(const mailbox of ['david@davit-fin.co.il','daviddavit55@gmail.com']){
 const u=new URL(gmailLink({mailbox,message_id:'18abc123deadbeef',id:'crm-uuid'}));assert.equal(u.origin,'https://mail.google.com');assert.equal(u.searchParams.get('authuser'),mailbox);assert.equal(u.hash,'#all/18abc123deadbeef');}
});
test('missing or untrusted identifiers do not produce links',()=>{
 for(const message_id of [undefined,'crm-uuid','javascript:alert(1)','abc/../../x'])assert.equal(gmailLink({mailbox:'a@b.com',message_id}),null);
 assert.equal(gmailLink({mailbox:'',message_id:'18abc123deadbeef'}),null);
 assert.ok(gmailLink({mailbox:'a@b.com',metadata:{threadId:'18abc123deadbeef'}}));
});
