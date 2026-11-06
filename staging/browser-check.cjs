// Isolated browser context, synthetic staging users only. No existing Chrome profile.
const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{const base='https://networth-staging-staging.up.railway.app';const key=JSON.parse(fs.readFileSync(path.join(__dirname,'../.staging-private/credentials.json'),'utf8')).STAGING_ACCESS_KEY;
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(r.url().endsWith('/__staging/unlock'))console.log('Login request origin:',r.headers().origin,'referer:',r.headers().referer);});
try{
 await page.goto(base);await page.locator('input[name=key]').fill(key);await page.getByRole('button',{name:'כניסה',exact:true}).click();await page.getByRole('button',{name:'כניסה כאדמין — CRM ותקציב'}).click();await page.getByRole('button',{name:'היום שלי',exact:true}).waitFor();
 await page.getByText('נשמר בשרת הבדיקה',{exact:true}).waitFor();await page.screenshot({path:path.join(__dirname,'../.staging-private/crm-desktop.png')});
 await page.goto(base+'/admin/clients');await page.getByText('לקוח סינתטי לבדיקה',{exact:true}).first().waitFor();
 await page.goto(base+'/budget');await page.waitForLoadState('networkidle');assert.ok((await page.locator('body').innerText()).includes('תקציב'));await page.screenshot({path:path.join(__dirname,'../.staging-private/budget-desktop.png')});
 await page.goto(base+'/__staging');await page.getByRole('button',{name:'כניסה כלקוח לדוגמה'}).click();await page.waitForLoadState('networkidle');assert.ok(!(await page.locator('body').innerText()).includes('לא הצלחנו לטעון את התיק'));await page.screenshot({path:path.join(__dirname,'../.staging-private/client-desktop.png')});
 assert.deepEqual(errors,[]);console.log('PASS: protected browser login, CRM, admin client list, budget and client portal render without JS errors.');
}catch(e){console.log('Browser page:',page.url(),(await page.locator('body').innerText()).slice(0,1200));await page.screenshot({path:path.join(__dirname,'../.staging-private/browser-failure.png')});throw e;}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
