const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({serviceWorkers:'block',viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('token','synthetic'));
 await page.route('**/*',async route=>{const u=new URL(route.request().url()),p=u.pathname;if(u.hostname!=='networth.test')return route.abort();
 if(p.startsWith('/api/')){let data={};if(p==='/api/auth/me')data={id:'test',email:'staging-admin@example.invalid'};
 if(p==='/api/staging/crm')data={state:{clients:[]},revision:1};
 if(p.endsWith('/sync-status'))data={accounts:[]};
 if(p.endsWith('/automation'))data={rows:[],reports:[]};
 if(p.endsWith('/received'))data={rows:[{id:'test-mail',mailbox:'david@davit-fin.co.il',message_id:'18abc123deadbeef',client_id:'test',metadata:{subject:'מייל בדיקה',from:'sender@example.com',to:'owner@example.com',at:'2026-10-04'},pdf_count:1}]};
 if(p.includes('/view/'))data={subject:'מייל בדיקה',from:'sender@example.com',to:'owner@example.com',text:'שלום דוד\n<script>alert(1)</script>\nתוכן הודעת בדיקה',attachments:[{index:0,name:'proof.pdf',size:200}]};
 return route.fulfill({json:data});}
 const root=path.resolve(__dirname,process.env.STAGING_TEST_DIST||'../.release/mail-view-local/frontend/dist'),file=p.startsWith('/assets/')?path.join(root,p):path.join(root,'index.html');return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
 });await page.goto('https://networth.test/admin/crm');await page.getByRole('button',{name:'תיבת עדכונים',exact:true}).click();await page.getByRole('button',{name:'צפייה במייל',exact:true}).click();if(process.env.CHECK_GMAIL){const link=page.getByRole('link',{name:'פתיחה ב־Gmail'});assert.equal(await link.getAttribute('href'),'https://mail.google.com/mail/?authuser=david%40davit-fin.co.il#all/18abc123deadbeef');assert.equal(await link.getAttribute('target'),'_blank');}
 const dialog=page.getByRole('dialog');await dialog.getByText('תוכן הודעת בדיקה',{exact:false}).waitFor();assert.equal(await dialog.locator('script').count(),0);const box=await dialog.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=1000);await page.screenshot({path:path.resolve(__dirname,'../.staging-private/mail-view-ui.png')});await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);assert.deepEqual(errors,[]);console.log('PASS: viewer, escaped content, attachment, centered dialog, Escape, no page errors');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
