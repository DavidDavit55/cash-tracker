const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const {makeClient}=await import('../.local-preview/workflow-model.js');
 const c=makeClient({name:'בדיקת הקלדה',identity:'123456789'});c.call='done';c.products=[{id:'p',category:'פנסיה',company:'הראל',name:'פנסיה בדיקה',policy:'123',track:'כללי',coverage:[]}];
 let state={clients:[c],selected:c.id},revision=1,active=0,maxActive=0,fail=false;const errors=[];
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{const page=await browser.newPage({serviceWorkers:'block'});page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('token','synthetic'));
 const root=path.resolve(__dirname,'../.staging-release/frontend/dist');
 await page.route('**/*',async route=>{const u=new URL(route.request().url()),p=u.pathname;if(u.hostname!=='networth.test')return route.abort();
 if(p.startsWith('/api/')){let data={};if(p==='/api/auth/me')data={id:'test',email:'staging-admin@example.invalid'};
 if(p==='/api/staging/crm'){if(route.request().method()==='PUT'){active++;maxActive=Math.max(active,maxActive);const body=route.request().postDataJSON();await new Promise(r=>setTimeout(r,700));active--;if(fail)return route.fulfill({status:409,json:{error:'conflict'}});assert.equal(body.revision,revision);state=body.state;revision++;}data={state,revision};}return route.fulfill({json:data});}
 const file=p.startsWith('/assets/')||p.startsWith('/sandbox-')||p.endsWith('.png')?path.join(root,p):path.join(root,'index.html');return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':undefined});});
 async function open(){await page.getByRole('button',{name:'לקוחות',exact:true}).click();await page.getByRole('button',{name:'פתיחת תיק',exact:true}).click();await page.getByRole('button',{name:'מוצרים והמלצות',exact:true}).click();await page.getByRole('button',{name:'להמלצות',exact:true}).click();}
 await page.goto('https://networth.test/admin/crm');await open();
 const dialog=page.getByRole('dialog',{name:'המלצות למוצר'});
 await dialog.getByRole('button',{name:'＋ הוספת הערה'}).first().click();
 const field=dialog.locator('textarea').first();await field.focus();const before=await page.evaluate(()=>window.scrollY);
 const text='בדיקת הקלדה רציפה ללא איבוד אותיות 123';
 await field.pressSequentially(text.slice(0,12),{delay:40});await page.waitForTimeout(350);await field.pressSequentially(text.slice(12),{delay:40});
 assert.equal(await field.inputValue(),text);assert.ok(await field.evaluate(e=>document.activeElement===e));
 assert.ok(Math.abs(await page.evaluate(()=>window.scrollY)-before)<5);
 await page.waitForFunction(()=>document.querySelector('.staging-toolbar').textContent.includes('כל השינויים נשמרו'));
 assert.ok(JSON.stringify(state).includes(text));assert.equal(maxActive,1);
 await page.reload();await open();assert.equal(await dialog.locator('textarea').first().inputValue(),text);
 fail=true;await dialog.locator('textarea').first().focus();await dialog.locator('textarea').first().press('Control+End');await dialog.locator('textarea').first().pressSequentially(' טיוטה');await page.locator('.staging-save-error').waitFor();
 assert.equal(await dialog.locator('textarea').first().inputValue(),text+' טיוטה');assert.ok(!JSON.stringify(state).includes(text+' טיוטה'));
 assert.deepEqual(errors,[]);console.log('PASS: slow network typing intact, serial writes, focus/scroll stable, reload persists, conflict preserves draft.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
