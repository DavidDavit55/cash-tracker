// Isolated synthetic browser. Every request is intercepted; no live service is used.
const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../.staging-release/frontend/dist');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({serviceWorkers:'block'}),errors=[],external=[];let healthy=false,authCalls=0,crmCalls=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('token','synthetic-retry-token'));
  await page.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url()),p=u.pathname;
   if(u.hostname!=='networth.test'){external.push(u.hostname);return route.abort();}
   if(p==='/api/auth/me'){
    authCalls++;assert.equal(request.headers().authorization,'Bearer synthetic-retry-token');
    return healthy?route.fulfill({json:{id:'test',email:'staging-admin@example.invalid'}}):route.fulfill({status:503,json:{error:'synthetic temporary outage'}});
   }
   if(p.startsWith('/api/')){
    assert.equal(request.method(),'GET','retry must not write CRM or external services');
    if(p==='/api/staging/crm'){crmCalls++;return route.fulfill({json:{state:{clients:[],selected:null,deletedClients:[]},revision:1}});}
    return route.fulfill({json:{}});
   }
   const file=p.startsWith('/assets/')||p.startsWith('/sandbox-')||p.endsWith('.png')?path.join(root,p):path.join(root,'index.html');
   return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':undefined});
  });
  await page.goto('https://networth.test/admin/crm');
  const message=page.getByRole('alert').filter({hasText:'לא ניתן לטעון כרגע את סביבת הבדיקה'});await message.waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('token')),'synthetic-retry-token');
  assert.equal(crmCalls,0,'CRM must not mount before authentication succeeds');const failedCalls=authCalls;
  healthy=true;await message.getByRole('button',{name:'ניסיון חוזר',exact:true}).click();
  await page.getByRole('button',{name:'לקוחות',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.staging-toolbar')?.textContent.includes('כל השינויים נשמרו'));
  assert.ok(authCalls>failedCalls);assert.ok(crmCalls>0);assert.equal(await message.count(),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('token')),'synthetic-retry-token');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS: staging auth 503 displays recoverable error, preserves token, retry reauthenticates and loads CRM; no external calls or writes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
