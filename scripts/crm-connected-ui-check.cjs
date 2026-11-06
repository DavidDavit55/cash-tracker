const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const origin='http://127.0.0.1:4201';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(r.url());});
 let original;
 const get=async()=>{const r=await context.request.get(origin+'/api/crm/state');assert.equal(r.status(),200);return r.json();};
 const put=async(revision,state)=>context.request.put(origin+'/api/crm/state',{data:{revision,state}});
 try{
  assert.equal((await context.request.get(origin+'/api/crm/state')).status(),401);
  await page.goto(origin+'/admin/crm');await page.getByText(/כל השינויים נשמרו/).waitFor();original=await get();
  assert.ok(original.state.clients.length>0);
  await page.getByRole('button',{name:'לטיפול ←',exact:true}).first().click();
  await page.getByRole('button',{name:'פרטים והרשאות',exact:true}).click();
  await page.getByText(/כל השינויים נשמרו/).waitFor();
  assert.equal(await page.locator('.unified-nav button[aria-current="page"]').innerText(),'לקוחות');
  const selected=(await get()).state.selected;
  assert.ok(original.state.clients.some(c=>c.id===selected));
  const marker='LOCAL REVIEW PERSISTENCE CHECK';
  await page.locator('textarea[name="needs"]').fill(marker);
  await page.getByRole('button',{name:'שמירת פרטים',exact:true}).click();
  await page.getByText(/כל השינויים נשמרו/).waitFor();
  assert.equal((await get()).state.clients.find(c=>c.id===selected).needs,marker);
  await page.reload();await page.getByText(/כל השינויים נשמרו/).waitFor();
  await page.locator('.unified-nav').getByRole('button',{name:'לקוחות',exact:true}).click();
  await page.locator('.wf-list-row').filter({has:page.getByRole('heading',{name:original.state.clients.find(c=>c.id===selected).name,exact:true})}).getByRole('button',{name:'פתיחת תיק',exact:true}).click();
  await page.getByRole('button',{name:'פרטים והרשאות',exact:true}).click();
  assert.equal(await page.locator('textarea[name="needs"]').inputValue(),marker);
  // A real second writer advances the revision. The first UI must fail closed.
  const current=await get();assert.equal((await put(current.revision,current.state)).status(),200);
  await page.locator('textarea[name="needs"]').fill('STALE DRAFT MUST NOT OVERWRITE');
  await page.getByRole('button',{name:'שמירת פרטים',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'הנתונים השתנו בחלון אחר'}).waitFor();
  assert.equal((await get()).state.clients.find(c=>c.id===selected).needs,marker);
  assert.equal(await page.getByRole('button',{name:'הורדת הטיוטה שלא נשמרה'}).count(),1);
  assert.equal(await page.locator('[inert]').count(),1);
  assert.equal((await context.request.post(origin+'/api/staging/mail/summary',{data:{}})).status(),403);
  assert.equal((await context.request.post(origin+'/api/crm/mail/summary',{data:{}})).status(),503);
  assert.equal((await context.request.get(origin+'/api/crm/state',{headers:{Origin:'https://evil.example'}})).status(),403);
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 }finally{
  if(original){const latest=await get();assert.equal((await put(latest.revision,original.state)).status(),200);assert.deepEqual((await get()).state,original.state);}
 }
 try{
  await page.reload();await page.getByText(/כל השינויים נשמרו/).waitFor();
  await page.screenshot({path:'.release/crm-connected-review/desktop.png',fullPage:true});
  await page.locator('.unified-nav').getByRole('button',{name:'יומן עסקי',exact:true}).click();
  await page.locator('.owner-week').waitFor();
  await page.locator('.unified-nav').getByRole('button',{name:'התקציב שלי',exact:true}).click();
  await page.getByRole('heading',{name:'התקציב שלי',exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.locator('.unified-nav').getByRole('button',{name:'לוח מחוונים לבעלים',exact:true}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  await page.screenshot({path:'.release/crm-connected-review/mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const evidence={result:'PASS',at:new Date().toISOString(),localOnly:true,persistenceAfterReload:true,staleWriteRejected:true,draftRetained:true,taskNavigation:true,calendarVisible:true,budgetPreserved:true,externalRequests:0,originalStateRestored:true,desktop:true,mobile:true};
  fs.writeFileSync('.release/crm-connected-review/ui-check.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
