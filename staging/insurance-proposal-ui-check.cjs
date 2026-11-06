// Synthetic intercepted browser only: no real accounts, mail, or CRM writes.
const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const {makeClient}=await import('../.local-preview/workflow-model.js');
 const c=makeClient({name:'בדיקת הצעת ביטוח',identity:'123456789'});c.call='done';
 c.products=[{id:'life',category:'ביטוח חיים',company:'כלל',name:'ביטוח חיים בדיקה',policy:'TEST-LIFE',premium:150,coverage:[]}];
 let state={clients:[c],selected:c.id},revision=1;const errors=[],external=[];
 const root=path.resolve(__dirname,'../.staging-release/frontend/dist'),browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({serviceWorkers:'block'});page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('token','synthetic'));
  await page.route('**/*',async route=>{const request=route.request(),u=new URL(request.url()),p=u.pathname;if(u.hostname!=='networth.test'){external.push(u.hostname);return route.abort();}
   if(p.startsWith('/api/')){let data={};if(p==='/api/auth/me')data={id:'test',email:'staging-admin@example.invalid'};
    if(p==='/api/staging/crm'){if(request.method()==='PUT'){state=request.postDataJSON().state;revision++;}data={state,revision};}
    else if(request.method()!=='GET')external.push(p);
    return route.fulfill({json:data});}
   const file=p.startsWith('/assets/')||p.startsWith('/sandbox-')||p.endsWith('.png')?path.join(root,p):path.join(root,'index.html');return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':undefined});
  });
  const saved=()=>page.waitForFunction(()=>document.querySelector('.staging-toolbar').textContent.includes('כל השינויים נשמרו'));
  await page.goto('https://networth.test/admin/crm');await page.getByRole('button',{name:'לקוחות',exact:true}).click();await page.getByRole('button',{name:'פתיחת תיק',exact:true}).click();await page.getByRole('button',{name:'מוצרים והמלצות',exact:true}).click();await page.getByRole('button',{name:'להמלצות',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'המלצות למוצר'}),premium=dialog.locator('.pr-parameter').filter({hasText:'עלות הביטוח'});
  assert.equal(await premium.getByRole('option',{name:'הזדמנות להוזיל',exact:true}).count(),1);await premium.getByRole('combobox').selectOption('action');
  await dialog.getByLabel('פרמיה מוצעת לחודש (₪)',{exact:true}).fill('85');await dialog.getByLabel('סכום ביטוח מוצע (₪)',{exact:true}).fill('750000');await saved();
  assert.ok(JSON.stringify(state).includes('750000'));await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'פגישה וסיכום',exact:true}).click();
  const life=page.locator('[data-product-id="life"]');if(!await life.evaluate(e=>e.open))await life.locator('summary').click();
  await life.getByLabel('מה סוכם בפגישה').selectOption('החלפת מוצר קיים — שחלוף בהתאם לסיכום');
  assert.equal(await life.getByLabel('פרמיה מוצעת לחודש',{exact:true}).inputValue(),'85');assert.equal(await life.getByLabel('סכום ביטוח מוצע',{exact:true}).inputValue(),'750000');
  assert.equal(await life.locator('[name="agreedCoverage"]').count(),0);
  await life.getByLabel('חברת ביטוח יעד').selectOption('מגדל');await life.getByLabel('המוטבים שסוכמו עם הלקוח').fill('בן זוג 100%');await life.getByLabel('תנאים והחרגות שסוכמו (לרבות ללא החרגות אם אושר)').fill('ללא החרגות');await life.getByLabel('תאריך תחילת הביטוח שסוכם').fill('2099-08-25');await life.getByRole('button',{name:'שמירת החלטה למוצר',exact:true}).click();await saved();
  assert.equal(state.clients[0].decisions.find(d=>d.productId==='life').targetCoverage,'750000');
  const health=page.locator('[data-product-id="proposed-health"]');await page.waitForFunction(()=>document.querySelector('[data-product-id="proposed-health"]').open);
  await health.getByLabel('מה סוכם בפגישה').selectOption('הצטרפות למוצר חדש בהתאם לסיכום');await health.getByLabel('חברת ביטוח יעד').selectOption('הראל');await health.getByLabel('פרמיה מוצעת לחודש',{exact:true}).fill('100');await health.getByLabel('תרופות מחוץ לסל',{exact:true}).check();
  assert.equal(await health.locator('[name="agreedCoverage"]').count(),0);assert.equal(await health.locator('[name="riderDetail"]').evaluate(e=>e.required),false);
  await health.getByLabel('תנאים והחרגות שסוכמו (לרבות ללא החרגות אם אושר)').fill('ללא החרגות');await health.getByLabel('תאריך תחילת הביטוח שסוכם').fill('2099-08-25');await health.getByRole('button',{name:'שמירת החלטה למוצר',exact:true}).click();await saved();
  const decision=state.clients[0].decisions.find(d=>d.productId==='proposed-health');assert.deepEqual(decision.riders,['תרופות מחוץ לסל']);assert.equal(decision.riderDetail,'');
  await page.getByLabel('תאריך הפגישה',{exact:true}).fill('2026-09-30');await page.getByRole('button',{name:'שמירת סיכום הפגישה',exact:true}).click();await saved();assert.ok(state.clients[0].summary.includes('750000'),state.clients[0].summary);assert.ok(state.clients[0].summary.includes('תרופות מחוץ לסל'));
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS: life opportunity label and premium/sum proposal persist into meeting and summary; health checkbox-only proposal saves without duplicate coverage or extra rider text; no external calls.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
