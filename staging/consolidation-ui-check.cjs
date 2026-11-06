const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const {makeClient}=await import('../.local-preview/workflow-model.js'),root=path.resolve(__dirname,'../.staging-release/frontend/dist');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const mode of ['existing','new']){
  const c=makeClient({name:'לקוח סינתטי לבדיקת איחוד',identity:'012345678',phone:'0500000000',source:'בדיקה'});c.call='בדיקה';c.products=[{id:'target',category:'פנסיה',name:'קרן יעד קיימת',company:'הראל',policy:'0000000012345678',balance:5000.11,asOf:'2026-09-01',track:'מניות',depositFee:1,balanceFee:0.1,coverage:[]},{id:'source-p',category:'פנסיה',company:'כלל',policy:'012345678',balance:1000.12,coverage:[]},{id:'source-g',category:'גמל',company:'מיטב',policy:'TEST-GEMEL',balance:2000.23,coverage:[]}];
  let state={clients:[c],selected:c.id},revision=1;const errors=[],writes=[];
  const page=await browser.newPage({serviceWorkers:'block',viewport:{width:1440,height:1050}});page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('token','synthetic'));
  await page.route('**/*',async route=>{const u=new URL(route.request().url()),p=u.pathname;if(u.hostname!=='networth.test')return route.abort();
   if(p==='/preview-catalogue')return route.fulfill({json:{rows:[{id:'111',name:'הראל פנסיה מניות',manager:'הראל',classification:'מקיפה',reportPeriod:'202608'}]}});
   if(p.startsWith('/api/')){let data={};if(route.request().method()!=='GET')writes.push(p);if(p==='/api/auth/me')data={id:'test',email:'staging-admin@example.invalid'};if(p==='/api/staging/crm'){if(route.request().method()==='PUT'){state=route.request().postDataJSON().state;revision++;}data={state,revision};}return route.fulfill({json:data});}
   const file=p.startsWith('/assets/')||p.startsWith('/sandbox-')||p.endsWith('.png')?path.join(root,p):path.join(root,'index.html');return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':undefined});
  });
  async function saved(){await page.waitForFunction(()=>document.querySelector('.staging-toolbar')?.textContent.includes('כל השינויים נשמרו'));}
  await page.goto('https://networth.test/admin/crm');await page.getByRole('button',{name:'לקוחות',exact:true}).click();await page.getByRole('button',{name:'פתיחת תיק',exact:true}).click();await page.getByRole('button',{name:'מוצרים והמלצות',exact:true}).click();
  await page.getByRole('button',{name:'+ איחוד קופות',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('לאן לאחד?').selectOption(mode);
  if(mode==='existing')await dialog.getByLabel('קופת היעד הקיימת').selectOption('target');
  await dialog.getByRole('checkbox',{name:/פנסיה · כלל/}).check();await dialog.getByRole('checkbox',{name:/^גמל · מיטב/}).check();
  await dialog.getByLabel('מצב מקור — כלל').selectOption('active');await dialog.getByLabel('מצב מקור — מיטב').selectOption('inactive');await dialog.getByRole('checkbox',{name:/בדקתי ש־גמל/}).check();await dialog.getByRole('checkbox',{name:/בדקתי את התאמת/}).check();
  if(mode==='new'){await dialog.getByLabel('גוף מנהל יעד').selectOption('הראל');await dialog.getByLabel('קרן ומסלול יעד 1').selectOption('111');await dialog.getByLabel('דמי ניהול מהפקדה שסוכמו (%)',{exact:true}).fill('1');await dialog.getByLabel('דמי ניהול מצבירה שסוכמו (%)',{exact:true}).fill('0.1');}
  const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.y+box.height<=1051,'dialog visible and centered within viewport');
  await dialog.getByRole('button',{name:'שמירת החלטת איחוד הקופות',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));await saved();
  assert.equal(state.clients[0].consolidations.length,1);assert.equal(state.clients[0].decisions.length,2);assert.equal(state.clients[0].products.length,3);assert.ok(state.clients[0].products.every(p=>!p.archived));assert.equal(state.clients[0].products[0].balance,5000.11);assert.ok(await page.getByText('0 מתוך 2 מקורות נקלטו',{exact:true}).count());
  await page.getByRole('button',{name:'פגישה וסיכום',exact:true}).click();assert.equal(await page.locator('[data-product-id="source-p"]').count(),0);assert.equal(await page.locator('[data-product-id="source-g"]').count(),0);
  // Current approved flow: entering the meeting starts with all cards closed.
  // Advancing automatically happens only after saving a product decision.
  if(mode==='existing')assert.equal(await page.locator('[data-product-id="target"]').count(),0);
  else assert.equal(await page.locator('[data-product-id="target"]').getAttribute('open'),null);
  assert.equal(await page.locator('[data-product-id="proposed-health"]').getAttribute('open'),null);
  await page.locator('[data-product-id="proposed-health"]>summary').click();
  const health=page.locator('[data-product-id="proposed-health"]');await health.getByLabel('מה סוכם בפגישה').selectOption('לא מעוניין כרגע');await health.getByLabel('הכיסויים וההצעה שהוצגו בפועל').fill('תרופות והשתלות — הצעה סינתטית בלבד');await health.getByLabel('חברת ההצעה (אם נמסרה)').fill('הראל');await health.getByLabel('פרמיה חודשית שהוצעה (אם נמסרה)').fill('123');await health.getByRole('checkbox',{name:/ההצעה הוצגה ללקוח/}).check();await health.getByLabel('סיבת הסירוב שנמסרה — לתיעוד פנימי בלבד (רשות)').fill('PRIVATE-REASON');await health.getByRole('button',{name:'שמירת החלטה למוצר',exact:true}).click();await saved();
  await page.getByLabel('תאריך הפגישה',{exact:true}).fill('2026-09-29');await page.getByRole('button',{name:'שמירת סיכום הפגישה',exact:true}).click();await saved();assert.ok(state.clients[0].summary.includes('תרופות והשתלות'));assert.ok(state.clients[0].summary.includes('בחר שלא להצטרף'));assert.ok(!state.clients[0].summary.includes('PRIVATE-REASON'));assert.equal(state.clients[0].decisions.find(d=>d.productId==='proposed-health').healthOffer.reason,'PRIVATE-REASON');
  await page.reload();await page.getByRole('button',{name:'לקוחות',exact:true}).click();await page.getByRole('button',{name:'פתיחת תיק',exact:true}).click();await page.getByRole('button',{name:'מוצרים והמלצות',exact:true}).click();assert.ok(await page.getByText('0 מתוך 2 מקורות נקלטו',{exact:true}).count());
  assert.deepEqual(errors,[]);assert.ok(writes.every(p=>p==='/api/staging/crm'),'no emails/calendar/tasks/external writes');await page.close();
 }console.log('PASS: isolated existing/new consolidation UI, centered dialog, group locks, health offer/refusal privacy, persisted reload; no real network or customer writes.');}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
