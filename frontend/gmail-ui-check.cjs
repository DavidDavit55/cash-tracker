// Isolated browser profile and fake API responses; never contacts the live backend.
const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:950}});const errors=[];let linked=null,restored=false,scanned=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('token','mock-test-token'));
  await page.route('**/api/**',async r=>{
   const path=new URL(r.request().url()).pathname;
   if(!path.startsWith('/api/'))return r.continue();
   let data={};
   if(path.endsWith('/auth/me'))data={id:'test-admin',email:'david@davit-fin.co.il',name:'דוד · בדיקה'};
   else if(path.endsWith('/gmail/status'))data={configured:true,accounts:[{email:'david@davit-fin.co.il',connection:{email:'david@davit-fin.co.il',last_sync_at:null,has_more:false,pending_body_scan:scanned?0:1}},{email:'daviddavit55@gmail.com',connection:null}]};
   else if(path.endsWith('/gmail/sync')){scanned=r.request().postDataJSON().scanExisting===true;data={imported:1,hasMore:false};}
   else if(path.endsWith('/gmail/messages/a/link')){linked=r.request().postDataJSON().clientId;data={ok:true};}
   else if(path.endsWith('/gmail/messages/ad/triage')){restored=r.request().postDataJSON().bucket==='review';data={ok:true};}
   else if(path.endsWith('/gmail/messages'))data={hasMore:false,clients:[{id:'client-1',name:'לקוח בדיקה'}],messages:[{mailbox:'david@davit-fin.co.il',message_id:'a',thread_id:'b',direction:'incoming',message_at:'2026-09-27T12:00:00Z',subject:'אישור קליטת מסמכים — נתוני בדיקה',from:'office@example.com',to:'david@davit-fin.co.il',cc:'',client_id:linked,suggestions:[]}]};
   if(path.endsWith('/gmail/messages')){
    data.messages[0].bodyScan={status:scanned?'complete':'pending',idCount:scanned?1:0};
    const view=new URL(r.request().url()).searchParams.get('view')||'work';
    const ad={...data.messages[0],message_id:'ad',subject:'מבצע השבוע בקרפור',client_id:null,triage:{bucket:restored?'review':'hidden',reason:'חשד לפרסום'}};
    if(view==='hidden')data.messages=restored?[]:[ad];
    else if(view==='review')data.messages=restored?[ad]:[];
   }
   await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('http://127.0.0.1:5199/admin/mail');
  try{await page.getByRole('heading',{name:'מיילים ולקוחות'}).waitFor({timeout:10000});}catch(e){console.log(JSON.stringify({url:page.url(),body:(await page.locator('body').innerText()).slice(0,1200),errors}));throw e;}
  await page.getByRole('button',{name:'סריקת גוף למיילים קיימים (1)'}).click();
  await page.getByText('גוף ההודעה נסרק; נמצאו 1 תעודות זהות תקינות מבחינת ספרת ביקורת.').waitFor();
  await page.getByRole('combobox').selectOption('client-1');
  await page.getByRole('button',{name:'אישור השיוך'}).click();
  await page.getByText('השיוך נשמר ונרשם בהיסטוריית השינויים.').waitFor();
  await page.getByRole('button',{name:'פרסומות ומוסתרים',exact:true}).click();
  await page.getByRole('heading',{name:'מבצע השבוע בקרפור'}).waitFor();
  await page.getByRole('button',{name:'החזרה לבדיקה'}).click();
  await page.getByRole('heading',{name:'מבצע השבוע בקרפור'}).waitFor({state:'hidden'});
  await page.getByRole('button',{name:'דורשים בדיקה',exact:true}).click();
  await page.getByRole('heading',{name:'מבצע השבוע בקרפור'}).waitFor();
  await page.screenshot({path:require('path').resolve('.local-preview/gmail-ui.png'),fullPage:true});
  await page.setViewportSize({width:390,height:850});
  const overflow=await page.locator('.gmail-page').evaluate(e=>e.scrollWidth>e.clientWidth+2);
  console.log(JSON.stringify({errors,manualLink:linked==='client-1',restored,bodyScanned:scanned,mobileOverflow:overflow}));
  if(errors.length||overflow||!restored||!scanned||linked!=='client-1')process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
