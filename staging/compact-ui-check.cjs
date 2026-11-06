// Synthetic, isolated browser: no CRM writes or external requests.
const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const {makeClient,fixtures}=await import('../.local-preview/workflow-model.js');
 const c=makeClient({name:'לקוח בדיקת פריסה',phone:'0500000000',identity:'123456789'});c.call='בדיקה';c.products=fixtures('2026-09-30');
 c.summary='סיכום בדיקה שמור\nשורה נוספת';
 c.consolidations=[{id:'test-group',sourceIds:[c.products[0].id],sourceDecisionIds:[],sourceSnapshots:[],agreement:{target:'בדיקה'},targetCategory:'פנסיה',receipts:{}}];
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('token','synthetic'));
  const root=path.resolve(__dirname,'../frontend/dist');
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url()),p=u.pathname;if(u.hostname!=='networth.test')return route.abort();
   if(p.startsWith('/api/'))return route.fulfill({json:p==='/api/auth/me'?{id:'test',email:'staging-admin@example.invalid'}:p==='/api/staging/crm'?{state:{clients:[c],selected:c.id},revision:1}:{}});
   const file=p.startsWith('/assets/')||p.startsWith('/sandbox-')||p.endsWith('.png')?path.join(root,p):path.join(root,'index.html');
   return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':undefined});
  });
  await page.goto('https://networth.test/admin/crm');await page.getByRole('button',{name:'לקוחות',exact:true}).click();await page.getByRole('button',{name:'פתיחת תיק',exact:true}).click();await page.getByRole('button',{name:'מוצרים והמלצות',exact:true}).click();
  assert.equal(await page.locator('.wf-header').evaluate(e=>Math.round(e.getBoundingClientRect().height)),68);
  const health=page.locator('details.wf-panel').filter({has:page.locator('.wf-basic-health')});
  assert.ok((await health.boundingBox()).height<65);
  await health.locator(':scope > summary').click();
  assert.equal(await health.locator('.pr-product>summary').isVisible(),false);
  await health.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.resolve(__dirname,'../tmp/health-compact.png')});
  assert.equal(await health.locator('.pr-health-row').count(),3);
  assert.equal(await health.locator('textarea').count(),0);
  await health.getByRole('button',{name:'הוספת הערה',exact:true}).first().click();
  assert.equal(await health.locator('textarea').count(),1);
  await health.getByRole('button',{name:'סגירת הערה',exact:true}).click();
  await health.locator(':scope > summary').click();
  await page.getByRole('button',{name:'להמלצות',exact:true}).first().click();
  const track=page.locator('.pr-track-review');
  assert.equal(await page.getByRole('dialog').locator('.pr-selected').getByText('נכלל באיחוד קופות',{exact:true}).count(),1);
  assert.equal(await page.getByRole('dialog').locator('.pr-selected').getByText('תיעוד הבדיקה טרם הושלם',{exact:true}).count(),1);
  await track.getByRole('checkbox',{name:/חשיפה מנייתית גבוהה/}).check();
  await track.getByRole('checkbox',{name:/פיזור השקעות/}).check();
  assert.equal(await track.locator('input:checked').count(),2);
  await track.getByRole('checkbox',{name:/חשיפה מנייתית נמוכה/}).check();
  assert.equal(await track.getByRole('checkbox',{name:/חשיפה מנייתית גבוהה/}).isChecked(),false);
  await track.getByRole('checkbox',{name:/המסלול נמצא מתאים/}).check();
  assert.equal(await track.locator('input:checked').count(),1);
  await page.keyboard.press('Escape');
  for(const width of [1440,1024,390]){
   await page.setViewportSize({width,height:900});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow at '+width);
   await page.screenshot({path:path.resolve(__dirname,`../tmp/compact-${width}.png`)});
  }
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:'פגישה וסיכום',exact:true}).click();
  const preview=page.locator('.wf-summary-preview');
  assert.ok((await preview.boundingBox()).height<=42,'compact saved summary');
  await preview.locator('summary').click();
  assert.equal(await preview.locator('pre').innerText(),c.summary);
  await preview.locator('summary').click();
  await page.getByRole('button',{name:'מוצרים והמלצות',exact:true}).click();
  await page.getByRole('button',{name:/ליד חדש/}).click();
  const dialog=page.getByRole('dialog');
  const birth=dialog.locator('.wf-date-control').first();
  await birth.locator('input[type=text]').fill('30/09/1961');
  assert.equal(await birth.locator('input[type=hidden]').inputValue(),'1961-09-30');
  await birth.locator('input[type=date]').fill('1962-02-28');
  assert.equal(await birth.locator('input[type=text]').inputValue(),'28/02/1962');
  await birth.locator('input[type=text]').fill('31/02/1962');
  assert.equal(await birth.locator('input[type=text]').evaluate(e=>e.checkValidity()),false);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:/קביעת מועד/}).click();
  const moment=page.getByRole('dialog').locator('.wf-date-control').first();
  await moment.locator('input[type=text]').fill('01/10/2026 15:45');
  assert.equal(await moment.locator('input[type=hidden]').inputValue(),'2026-10-01T15:45');
  await moment.locator('input[type=datetime-local]').fill('2026-10-02T09:30');
  assert.equal(await moment.locator('input[type=text]').inputValue(),'02/10/2026 09:30');
  assert.deepEqual(errors,[]);console.log('PASS: compact layout plus typed/pasted date/time, calendar input synchronization and invalid date rejection; no live writes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
