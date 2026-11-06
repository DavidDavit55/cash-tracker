// Isolated headless profile, synthetic data and intercepted requests only.
const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../.staging-release/frontend/dist');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('token','synthetic'));
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='networth.test')return route.abort();const p=url.pathname;
  if(p.startsWith('/api/')){let data={};if(p==='/api/auth/me')data={id:'synthetic',email:'staging-admin@example.invalid',name:'בדיקה'};if(p==='/api/staging/crm')data={revision:1,state:{clients:[],selected:null,deletedClients:[]}};if(p==='/api/staging/calendar')data={ready:true,connected:true,events:[]};return route.fulfill({json:data});}
  const file=p.startsWith('/assets/')||p.startsWith('/sandbox-')||p.endsWith('.png')?path.join(root,p):path.join(root,'index.html');
  return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':undefined});
 });
 await page.goto('http://networth.test/admin/crm');await page.getByRole('button',{name:'יומן מחובר'}).waitFor();
 const toolbar=await page.locator('.staging-toolbar').boundingBox(),header=await page.locator('.wf-header').boundingBox(),sidebar=await page.locator('.wf-sidebar').boundingBox();
 assert.ok(toolbar.height<=52);assert.ok(sidebar.y>=header.y+header.height-1);assert.equal(await page.locator('.wf-demo').isVisible(),false);assert.equal(await page.locator('dialog[open]').count(),0);
 await page.getByRole('button',{name:'יומן מחובר'}).click();const dialog=page.getByRole('dialog',{name:'יומן הבדיקות'});await dialog.waitFor();const box=await dialog.boundingBox();assert.ok(Math.abs(box.x+box.width/2-720)<3);assert.ok(box.y>=0&&box.y+box.height<=950);
 await dialog.getByRole('button',{name:'סגירה',exact:true}).click();assert.equal(await dialog.isVisible(),false);assert.deepEqual(errors,[]);
 await page.getByRole('button',{name:'חיבור משימות',exact:true}).click();const tasks=page.getByRole('dialog',{name:'NETWORTH — תפעול'});await tasks.waitFor();assert.ok(await tasks.getByRole('button',{name:'חיבור Google Tasks האישי'}).isVisible());await tasks.getByRole('button',{name:'סגירה',exact:true}).click();
 await page.screenshot({path:path.resolve(__dirname,'../.staging-private/crm-clean-layout.png')});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('.staging-toolbar').evaluate(e=>e.scrollWidth<=window.innerWidth));
 console.log('PASS: compact toolbar, sidebar below header, hidden calendar panel, centered dialog, close, mobile toolbar; no live requests.');
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1});
