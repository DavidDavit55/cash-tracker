const { chromium } = require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage();let origin=null,status=null,google=false;
 await page.route('https://accounts.google.com/**',r=>{google=true;return r.fulfill({status:200,body:'OAuth destination intercepted; no Google request sent.'});});
 page.on('request',r=>{if(new URL(r.url()).pathname==='/connect')origin=r.headers().origin??'missing';});
 page.on('response',r=>{if(new URL(r.url()).pathname==='/connect')status=r.status();});
 await page.goto(process.argv[2]);await page.getByRole('button',{name:'המשך לאישור בגוגל'}).click();
 await page.waitForLoadState();
 console.log(JSON.stringify({origin,status,reachedGoogleRedirect:google}));
 }finally{await browser.close();}
})().catch(()=>{console.error('Browser check failed');process.exitCode=1});
