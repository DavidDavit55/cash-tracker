const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const {makeClient}=await import('../.local-preview/workflow-model.js');
 const root=path.resolve(process.env.STAGING_UI_DIST||path.join(__dirname,'../.staging-release/frontend/dist'));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const fail of [false,true]){
 const c=makeClient({name:'בדיקת מעבר',identity:'123456789'});c.call='done';
 c.products=['פנסיה','בריאות'].map((category,i)=>({id:'p'+i,category,company:'חברה',policy:'TEST'+i,coverage:[]}));
 let state={clients:[c],selected:c.id},revision=1,release;
 const page=await browser.newPage({serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('token','synthetic'));
 await page.route('**/*',async route=>{const u=new URL(route.request().url()),p=u.pathname;if(u.hostname!=='networth.test')return route.abort();
 if(p.startsWith('/api/')){let data={};if(p==='/api/auth/me')data={id:'test',email:'staging-admin@example.invalid'};
 if(p==='/api/staging/crm'){if(route.request().method()==='PUT'){
 const next=route.request().postDataJSON().state;
 if(next.clients[0].decisions.length){await new Promise(r=>release=r);if(fail)return route.fulfill({status:500,json:{error:'test'}});}
 state=next;revision++;}data={state,revision};}return route.fulfill({json:data});}
 const file=p.startsWith('/assets/')||p.startsWith('/sandbox-')||p.endsWith('.png')?path.join(root,p):path.join(root,'index.html');return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':undefined});});
 await page.goto('https://networth.test/admin/crm');await page.getByRole('button',{name:'לקוחות',exact:true}).click();await page.getByRole('button',{name:'פתיחת תיק',exact:true}).click();await page.getByRole('button',{name:'פגישה וסיכום',exact:true}).click();
 const first=page.locator('[data-product-id="p0"]'),second=page.locator('[data-product-id="p1"]');
 assert.equal(await page.locator('.wf-discussion[open]').count(),0);
 await first.locator('summary').click();
 await first.getByLabel('מה סוכם בפגישה').selectOption('להשאיר ללא שינוי');
 await first.getByRole('button',{name:'שמירת החלטה למוצר',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.staging-toolbar').textContent.includes('שומר'));
 assert.ok(await first.evaluate(e=>e.open));assert.equal(await second.evaluate(e=>e.open),false);
 for(let i=0;!release&&i<100;i++)await page.waitForTimeout(20);
 assert.equal(typeof release,'function');release();release=null;
 if(fail){await page.locator('.staging-save-error').waitFor();assert.ok(await first.evaluate(e=>e.open));assert.equal(await second.evaluate(e=>e.open),false);}
 else{await page.waitForFunction(()=>document.querySelector('[data-product-id="p1"]').open);assert.equal(await first.evaluate(e=>e.open),false);
 await second.getByLabel('מה סוכם בפגישה').selectOption('להשאיר ללא שינוי');await second.getByRole('button',{name:'שמירת החלטה למוצר',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.staging-toolbar').textContent.includes('שומר'));for(let i=0;!release&&i<100;i++)await page.waitForTimeout(20);assert.equal(typeof release,"function");release();await page.waitForFunction(()=>!document.querySelector('[data-product-id="p1"]').open);}
 assert.deepEqual(errors,[]);await page.close();
 }console.log('PASS: wait for server acknowledgement, collapse/open next, last closes, failed save stays open; mocked requests only.');}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
