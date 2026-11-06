const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const base='https://networth-staging-staging.up.railway.app';
 const config=JSON.parse(fs.readFileSync(path.join(__dirname,'../.staging-private/credentials.json'),'utf8'));
 const unlock=await fetch(base+'/__staging/unlock',{method:'POST',redirect:'manual',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({key:config.STAGING_ACCESS_KEY})});assert.equal(unlock.status,302);
 const cookie=unlock.headers.get('set-cookie').split(';')[0];
 const session=await fetch(base+'/__staging/session',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({role:'admin'})});assert.equal(session.status,200);
 const token=JSON.parse((await session.text()).match(/setItem\('token',(.*?)\);/)[1]);
 const headers={Cookie:cookie,Authorization:'Bearer '+token};
 const before=await (await fetch(base+'/api/staging/crm',{headers})).json();
 const html=await (await fetch(base+'/admin/crm',{headers})).text();
 const main=html.match(/src="([^"]+\/index-[^"]+\.js)"/)[1];
 const mainJs=await (await fetch(base+main,{headers})).text();
 const chunk=mainJs.match(/StagingCrm-[\w-]+\.js/)[0];
 const deployed=Buffer.from(await (await fetch(base+'/assets/'+chunk,{headers})).arrayBuffer());
 assert.ok(deployed.equals(fs.readFileSync(path.join(__dirname,'../.release/staging-20261007-admin-shell/frontend/dist/assets',chunk))),'Deployed CRM differs from candidate');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:cookie.split('=')[0],value:cookie.slice(cookie.indexOf('=')+1),url:base,httpOnly:true,secure:true}]);
  await context.addInitScript(t=>localStorage.setItem('token',t),token);
  let blockedWrites=0;await context.route('**/*',async route=>{const req=route.request();if(!req.url().startsWith(base)){return route.abort();}if(!['GET','HEAD'].includes(req.method())){blockedWrites++;return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Read-only verification'})});}return route.continue();});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/admin/crm');await page.getByRole('heading',{name:'לוח מחוונים לבעלים',exact:true}).waitFor();
  const nav=page.locator('.unified-nav');
  await nav.getByRole('button',{name:'יומן עסקי',exact:true}).click();assert.equal(await page.locator('.owner-day').count(),5);
  await nav.getByRole('button',{name:'התקציב שלי',exact:true}).click();await page.locator('.bw-metrics').waitFor();assert.equal(await page.locator('.unified-budget [role=alert]').count(),0);
  assert.equal(await nav.getByRole('button',{name:'לקוחות',exact:true}).count(),1); // Opening clients persists selection; deliberately not exercised on real data.
  await nav.getByRole('button',{name:'מיילים',exact:true}).click();await page.locator('.wf-main').waitFor();
  await nav.getByRole('button',{name:'תביעות',exact:true}).click();await page.getByRole('heading',{name:'בבנייה',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  const after=await (await fetch(base+'/api/staging/crm',{headers})).json();assert.equal(after.revision,before.revision);
  console.log(JSON.stringify({result:'PASS',dashboard:true,weeklyDays:5,budgetLoaded:true,mailNavigation:true,revision:after.revision,clientCount:after.state.clients.length,blockedWrites,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1)});
