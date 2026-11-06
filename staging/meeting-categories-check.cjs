const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const {makeClient,fixtures}=await import('../.local-preview/workflow-model.js');
 const c=makeClient({name:'בדיקת קטגוריות',identity:'123456789'});c.call='שיחה';c.products=fixtures('2026-09-30').reverse();
 let state={clients:[c],selected:c.id,deletedClients:[]},revision=1;
 const root=path.resolve(__dirname,'../frontend/dist'),browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({serviceWorkers:'block',viewport:{width:1440,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('token','synthetic'));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url()),p=u.pathname;if(u.hostname!=='networth.test')return route.abort();
  if(p.startsWith('/api/')){let data={};
   if(p==='/api/auth/me')data={id:'test',email:'staging-admin@example.invalid'};
   if(p==='/api/staging/crm'){if(route.request().method()==='PUT'){state=route.request().postDataJSON().state;revision++;}data={state,revision};}
   if(p==='/api/staging/calendar')data={connected:false,ready:false,events:[]};
   return route.fulfill({json:data});
  }
  const f=p.startsWith('/assets/')||p.startsWith('/sandbox-')||p.endsWith('.png')?path.join(root,p):path.join(root,'index.html');
  return route.fulfill({path:f,contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':undefined});
 });
 await page.goto('https://networth.test/admin/crm');
 await page.getByRole('button',{name:'לקוחות',exact:true}).click();
 await page.getByRole('button',{name:'פתיחת תיק',exact:true}).click();
 await page.getByRole('button',{name:'פגישה וסיכום',exact:true}).click();
 const filters=page.getByLabel('קטגוריות בפגישה וסיכום');await filters.waitFor();
 assert.match(await page.locator('.wf-meeting .wf-product-group h2').first().textContent(),/^פנסיה/);
 const pension=page.getByRole('region',{name:'דיון במוצרי פנסיה'});
 assert.equal(await page.locator('.wf-discussion[open]').count(),0);
 await pension.locator('summary').click();
 await pension.getByLabel('הערה קצרה למוצר (רשות)').fill('טיוטה נשמרת');
 await filters.getByRole('button',{name:'בריאות',exact:true}).click();assert.equal(await pension.isVisible(),false);
 await filters.getByRole('button',{name:'פנסיה',exact:true}).click();assert.equal(await pension.getByLabel('הערה קצרה למוצר (רשות)').inputValue(),'טיוטה נשמרת');
 await pension.getByLabel('מה סוכם בפגישה').selectOption('להשאיר ללא שינוי');
 await pension.getByRole('button',{name:'שמירת החלטה למוצר'}).click();
 await page.waitForFunction(()=>document.querySelector('.wf-meeting .wf-discussion')?.open===false);
 assert.equal(state.clients[0].decisions.length,1);assert.equal(state.clients[0].decisions[0].reason,'טיוטה נשמרת');
 await filters.getByRole('button',{name:'הכל',exact:true}).click();assert.deepEqual(errors,[]);
 console.log('PASS: category ordering, filtering, draft retention and saved decision preserved; synthetic local requests only.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
