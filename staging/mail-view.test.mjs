import test from 'node:test';
import assert from 'node:assert/strict';
import {readableMail,createMailView} from './mail-view.mjs';
test('decodes MIME text and attachment without exposing HTML',async()=>{
 const raw=Buffer.from('From: sender@example.com\r\nTo: owner@example.com\r\nSubject: test\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=x\r\n\r\n--x\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Hello</p><script>alert(1)</script><img src="https://tracker.invalid/pixel">\r\n--x\r\nContent-Type: application/pdf\r\nContent-Disposition: attachment; filename="proof.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\nJVBERg==\r\n--x--');
 const m=await readableMail(raw);assert.match(m.text,/Hello/);assert.doesNotMatch(m.text,/tracker|<script|alert/);assert.equal(m.attachments[0].name,'proof.pdf');assert.equal(m.html,undefined);
});
test('owner-scoped lookup returns missing without leaking message',async()=>{
 let args;const handler=createMailView({query:async(sql,values)=>{assert.match(sql,/owner_id=\$1/);args=values;return {rows:[]};}});
 const res={set(){return this;},sendStatus(code){this.code=code;},status(){return this;},json(){throw Error('unexpected');}};
 await handler({user:{id:'owner'},params:{kind:'received',id:'mail'},query:{}},res);assert.deepEqual(args,['owner','mail']);assert.equal(res.code,404);
});
