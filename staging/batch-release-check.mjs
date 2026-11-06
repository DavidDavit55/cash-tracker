// Authenticated, read-only staging verification / private pre-release recovery copy.
// Never POST a CRM update, calendar event, task or email. Session setup only.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='https://networth-staging-staging.up.railway.app';
const privateRoot=new URL('../.staging-private/',import.meta.url);
const config=JSON.parse(fs.readFileSync(new URL('credentials.json',privateRoot),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const request=(url,options={})=>fetch(base+url,{redirect:'manual',signal:AbortSignal.timeout(20000),...options});
assert.equal((await request('/api/staging/crm')).status,401);
assert.equal((await request('/api/staging/files/00000000-0000-0000-0000-000000000001')).status,401);
const health=await request('/api/health');assert.equal(health.status,200);assert.equal((await health.json()).environment,'staging');
const unlock=await request('/__staging/unlock',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({key:process.env.STAGING_LOGIN_PASSWORD||config.STAGING_ACCESS_KEY})});assert.equal(unlock.status,302);
const cookie=unlock.headers.get('set-cookie').split(';')[0];assert.match(unlock.headers.get('set-cookie'),/HttpOnly/i);assert.match(unlock.headers.get('set-cookie'),/Secure/i);
async function session(role){const r=await request('/__staging/session',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({role})});assert.equal(r.status,200);return JSON.parse((await r.text()).match(/setItem\('token',(.*?)\);/)[1]);}
const admin=await session('admin'),client=await session('client');
const headers={Cookie:cookie,Authorization:'Bearer '+admin};
if(process.argv.includes('--mail-view')){
 const path='/api/staging/mail/view/received/';
 assert.equal((await request(path+'00000000-0000-0000-0000-000000000001')).status,401);
 assert.equal((await request(path+'00000000-0000-0000-0000-000000000001',{headers:{Cookie:cookie,Authorization:'Bearer '+client}})).status,403);
 const list=await (await request('/api/staging/mail/received',{headers})).json();assert.ok(list.rows.length);
 const result=await request(path+list.rows[0].id,{headers});assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');const mail=await result.json();assert.equal(typeof mail.text,'string');assert.ok(Array.isArray(mail.attachments));assert.equal(mail.parsedAttachments,undefined);assert.equal(mail.html,undefined);
 console.log(JSON.stringify({result:'PASS',mailView:true,bodyReadable:!!mail.text,attachments:mail.attachments.length,accessControls:true}));process.exit(0);
}
const identity=await request('/api/auth/me',{headers});assert.equal(identity.status,200);assert.ok((await identity.json()).id);
assert.equal((await request('/api/staging/crm',{headers:{Cookie:cookie,Authorization:'Bearer '+client}})).status,403);
const snapshot=await request('/api/staging/crm',{headers});assert.equal(snapshot.status,200);const data=await snapshot.json();assert.ok(Array.isArray(data.state.clients));
if(process.argv.includes('--backup')){
 const directory=new URL('backups/'+new Date().toISOString().replace(/[:.]/g,'-')+'/',privateRoot);fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(new URL('crm.json',directory),JSON.stringify(data),{flag:'wx'});
 const files=new Map();function collect(value){if(!value||typeof value!=='object')return;if(value.storage==='staging-private'&&value.id)files.set(value.id,value);for(const child of Object.values(value))collect(child);}collect(data.state);
 const manifest=[];for(const [id,file] of files){assert.match(id,/^[a-f0-9-]{36}$/);const result=await request('/api/staging/files/'+id,{headers});assert.equal(result.status,200);const bytes=Buffer.from(await result.arrayBuffer());assert.equal(hash(bytes),file.sha256);fs.writeFileSync(new URL(id+'.bin',directory),bytes,{flag:'wx'});manifest.push({id,sha256:file.sha256,size:bytes.length});}
 fs.writeFileSync(new URL('manifest.json',directory),JSON.stringify({at:new Date().toISOString(),revision:data.revision,stateSha256:hash(JSON.stringify(data.state)),files:manifest}),{flag:'wx'});
 console.log(JSON.stringify({result:'PASS',privateBackup:path.basename(directory.pathname.slice(0,-1)),revision:data.revision,sourceFiles:manifest.length,crmWrites:0}));
}else{
 assert.equal((await request('/api/staging/files/00000000-0000-0000-0000-000000000001',{headers:{Cookie:cookie,Authorization:'Bearer '+client}})).status,403);
 assert.equal((await request('/api/staging/files/00000000-0000-0000-0000-000000000001',{headers})).status,404);
 const html=await (await request('/admin/crm',{headers})).text(),main=html.match(/src="([^"]+\/index-[^"]+\.js)"/)[1];
 const js=await (await request(main,{headers})).text(),chunk=js.match(/(StagingCrm-[\w-]+\.js)/)[1];
 const previous=process.argv[2]==='--previous';
 if(process.argv[2]&&!previous)assert.equal(chunk,process.argv[2]);
 const crm=await (await request('/assets/'+chunk,{headers})).text();
 if(previous){
  const oldRoot=new URL('../.release/staging-20261004-live-frontend/',import.meta.url);
  fs.mkdirSync(oldRoot,{recursive:true});
  const manifest=[];const queue=[['index.html',html], [main.replace(/^\//,''),js],['assets/'+chunk,crm]],seen=new Set();
  while(queue.length){
   const [name,known]=queue.shift();if(seen.has(name))continue;seen.add(name);
   assert.ok(!name.includes('..')&&!name.includes(':')&&!name.startsWith('/'));
   let bytes;if(known!==undefined)bytes=Buffer.from(known);else {const r=await request('/'+name,{headers});assert.equal(r.status,200,name);bytes=Buffer.from(await r.arrayBuffer());}
   if(name!=='index.html'&&hash(bytes)===hash(html))continue; // SPA fallback is not an asset.
   const destination=new URL(name,oldRoot);fs.mkdirSync(new URL('.',destination),{recursive:true});fs.writeFileSync(destination,bytes,{flag:'wx'});manifest.push({name,sha256:hash(bytes),size:bytes.length});
   if(/\.(html|js|css)$/.test(name))for(const match of bytes.toString().matchAll(/["'(`](\/?(?:assets\/)?[\w.-]+\.(?:js|css|png|svg|jpg|jpeg|webp|ico|woff2?))["')`]/g)){
    const ref=match[1];const relative=ref.startsWith('/')?ref.slice(1):ref.startsWith('assets/')?ref:path.posix.join(path.posix.dirname(name),ref);if(!seen.has(relative))queue.push([relative]);
   }
  }
  fs.writeFileSync(new URL('manifest.json',oldRoot),JSON.stringify({capturedAt:new Date().toISOString(),deploymentId:'cb494ec0-e462-4b0a-b271-ca32b24023ed',imageDigest:'sha256:b49558a91fd48c9ab23bcf51dc5004b0dcd0a26fc48fefe35d92d7ad59ba2996',scope:'Deployed frontend assets only. Local previous source package is separate and not proven byte-identical to the deployed server.',files:manifest},null,2),{flag:'wx'});
 }else {
  for(const text of ['איחוד קופות','קופת היעד הקיימת','שמירת בדיקת ההפקה','פתיחת פרטי לקוח','הורדת קובץ המקור','עריכה / ביטול פגישה','החתימה כבר תועדה במוצר אחר באותו קיט?','האם סוכמה בקשת הנחה?','סוכמה בקשת הנחה בדמי ניהול'])assert.ok(crm.includes(text),text);
  if(process.argv[2])assert.equal(hash(crm),hash(fs.readFileSync(process.env.STAGING_RELEASE_DIST?path.resolve(process.env.STAGING_RELEASE_DIST,'assets',chunk):new URL('../.staging-release/frontend/dist/assets/'+chunk,import.meta.url))),'Deployed bundle differs from tested package');
 }
 console.log(JSON.stringify({result:'PASS',chunk,revision:data.revision,privateGateway:true,clientForbidden:true,privateFilesRoute:true,crmWrites:0,externalSends:0}));
}
