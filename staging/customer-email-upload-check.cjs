// Local, intercepted browser verification. Source ZIP stays on this computer.
const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const JSZip=require('../frontend/node_modules/jszip'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
(async()=>{
 const file=process.argv[2];if(!file)throw Error('Supply a local clearinghouse ZIP');
 const zip=await JSZip.loadAsync(fs.readFileSync(file)),xml=[];
 for(const entry of Object.values(zip.files))if(/\.xml$/i.test(entry.name))xml.push(await entry.async('string'));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const owner=await page.evaluate(xml=>{const owners=xml.flatMap(text=>[...new DOMParser().parseFromString(text,'text/xml').getElementsByTagName('YeshutLakoach')]);const field=(node,name)=>[...node.children].find(c=>c.localName===name)?.textContent.trim();return {identity:field(owners[0],'MISPAR-ZIHUY-LAKOACH'),emails:[...new Set(owners.map(o=>field(o,'E-MAIL')?.toLowerCase()).filter(Boolean))]};},xml);
 assert.equal(owner.emails.length,1);
 const {makeClient}=await import('../.local-preview/workflow-model.js');const c=makeClient({name:'בדיקת קליטת מייל',identity:owner.identity.replace(/^0+(?=\d)/,'').padStart(9,'0'),phone:'0500000000'});
 let state={clients:[c],selected:null,deletedClients:[]},revision=1,archiveWrites=0;
 const root=path.resolve(__dirname,'../.staging-release/frontend/dist');
 await page.addInitScript(()=>localStorage.setItem('token','local-test'));
 await page.route('**/*',async route=>{const url=new URL(route.request().url()),p=url.pathname;if(url.hostname!=='networth.test')return route.abort();
 if(p.startsWith('/api/')){let data={};if(p==='/api/auth/me')data={id:'local-test',email:'staging-admin@example.invalid'};
 if(p==='/api/staging/files'&&route.request().method()==='POST'){archiveWrites++;const body=route.request().postDataBuffer();assert.deepEqual(body,fs.readFileSync(file));data={id:'00000000-0000-0000-0000-000000000001',sha256:createHash('sha256').update(body).digest('hex'),name:path.basename(file),source:'maslaka',storage:'staging-private',size:body.length};}
 if(p==='/api/staging/crm'){if(route.request().method()==='PUT'){state=route.request().postDataJSON().state;revision++;}data={state,revision};}
 return route.fulfill({json:data});}
 const asset=p.startsWith('/assets/')||p.startsWith('/sandbox-')||p.endsWith('.png')?path.join(root,p):path.join(root,'index.html');return route.fulfill({path:asset,contentType:asset.endsWith('.js')?'text/javascript':asset.endsWith('.css')?'text/css':asset.endsWith('.html')?'text/html':undefined});});
 async function upload(){await page.getByRole('button',{name:'העלאת מסלקה / הר הביטוח',exact:true}).click();await page.locator('input[type=file][accept=".zip,.xml"]').setInputFiles(file);const confirm=page.getByRole('button',{name:'אישור קליטה לתיק',exact:true});try{await confirm.waitFor({timeout:8000});}catch(e){console.log(await page.locator('.wf-dialog .wf-error').allTextContents());throw e;}const saved=archiveWrites===0?page.waitForResponse(r=>r.url().endsWith('/api/staging/crm')&&r.request().method()==='PUT'):null;await confirm.click();await page.getByRole('dialog').waitFor({state:'hidden'});if(saved)await saved;}
 await page.goto('https://networth.test/admin/crm');await page.getByRole('button',{name:'לקוחות',exact:true}).click();await page.getByRole('button',{name:'פתיחת תיק',exact:true}).click();
 await upload();assert.equal(state.clients[0].email,owner.emails[0]);assert.equal(state.clients[0].emailSource,'מסלקה — פרטי הלקוח הראשי');assert.equal(state.clients[0].reports[0].sourceFile.storage,'staging-private');assert.equal(archiveWrites,1);
 const products=state.clients[0].products.length,reports=state.clients[0].reports.length;
 await page.getByRole('button',{name:'פרטים והרשאות',exact:true}).click();await page.getByText(owner.emails[0],{exact:true}).waitFor();
 await upload();assert.equal(state.clients[0].email,owner.emails[0]);assert.equal(state.clients[0].products.length,products);assert.equal(state.clients[0].reports.length,reports);
 await page.reload();await page.getByRole('button',{name:'לקוחות',exact:true}).click();await page.getByRole('button',{name:'פתיחת תיק',exact:true}).click();await page.getByRole('button',{name:'פרטים והרשאות',exact:true}).click();await page.getByText(owner.emails[0],{exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: actual ZIP upload extracts customer email, saves client field, displays it after reload, and reimport creates no duplicates. No external writes or mail.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
