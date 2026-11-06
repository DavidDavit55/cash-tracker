// Isolated synthetic browser. Every request intercepted; no real records or sends.
const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const {makeClient}=await import('../.local-preview/workflow-model.js');
 const {recordSmsKit,israelDate}=await import('../.local-preview/workflow-process.js');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const root=path.resolve(__dirname,'../.staging-release/frontend/dist');
 try{for(const legacy of [false,true]){
  const c=makeClient({name:'בדיקת ביטול סינתטית',identity:'123456789',phone:'0500000000'});
  c.products=[{id:'old',category:'בריאות',company:'הראל',policy:'TEST-OLD',pendingCancellation:true},{id:'new',category:'בריאות',company:'הפניקס',policy:'TEST-NEW'}];
  const d={id:'d',productId:'old',action:'החלפת מוצר קיים — שחלוף בהתאם לסיכום',cancelAnnex:'ג',target:'הפניקס',produced:true,effective:israelDate(),tasks:{verify:{done:true}}};
  Object.assign(d,recordSmsKit(d));c.decisions=[d];c.summarySent=true;
  if(legacy)d.tasks.cancel={done:true,reference:'אישור קודם',file:{name:'prior-cancellation.txt',data:'data:text/plain,SYNTHETIC'}};
  let state={clients:[c],selected:c.id,deletedClients:[]},revision=1;const errors=[],external=[];
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('token','synthetic'));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url()),p=url.pathname;
   if(url.hostname!=='networth.test'){external.push(url.origin);return route.abort();}
   if(p.startsWith('/api/')){
    let data={};
    if(p==='/api/auth/me')data={id:'synthetic',email:'staging-admin@example.invalid'};
    if(p==='/api/staging/crm'){if(route.request().method()==='PUT'){state=route.request().postDataJSON().state;revision++;}data={state,revision};}
    if(p==='/api/staging/calendar')data={ready:false,connected:false,events:[]};
    if(route.request().method()==='POST'){external.push(p);return route.fulfill({status:403,json:{error:'Synthetic test blocks sends'}});}
    return route.fulfill({json:data});
   }
   const file=p.startsWith('/assets/')||p.startsWith('/sandbox-')||p.endsWith('.png')?path.join(root,p):path.join(root,'index.html');
   return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':undefined});
  });
  await page.goto('https://networth.test/admin/crm');
  await page.getByRole('button',{name:'לקוחות',exact:true}).click();
  await page.getByRole('button',{name:'פתיחת תיק',exact:true}).click();
  await page.getByRole('button',{name:/ביצוע ומעקב/}).click();
  const panel=page.locator('.wf-followup');await panel.getByText('מעקב ואישור ביטול הפוליסה הישנה',{exact:true}).waitFor();
  assert.equal(await page.getByText('תיעוד שליחת בקשת הביטול',{exact:true}).count(),0);
  assert.ok((await panel.innerText()).includes('תזכורת לבדיקה בלבד'));
  const date=panel.getByLabel('תאריך בדיקת ביטול בפועל',{exact:true});assert.equal(await date.getAttribute('min'),null);
  if(legacy){await panel.getByRole('link',{name:'prior-cancellation.txt',exact:true}).waitFor();assert.equal(await panel.getByLabel('פרטי אישור הביטול',{exact:true}).inputValue(),'אישור קודם');}
  else{
   await panel.getByRole('button',{name:'יצירת מסמך דמה — אישור ביטול בכתב מהחברה',exact:true}).click();
   await panel.getByLabel('פרטי אישור הביטול',{exact:true}).fill('אישור ביטול בדיקה');
  }
  await date.fill(israelDate());await panel.getByRole('checkbox').check();
  await panel.getByRole('button',{name:'שמירת תיעוד וסיום המשימה',exact:true}).click();
  await panel.getByText('מסירת מסמכי הביצוע ללקוח',{exact:true}).waitFor();
  await page.getByRole('status').filter({hasText:'כל השינויים נשמרו'}).waitFor();
  assert.ok(state.clients[0].decisions[0].tasks.cancelCheck.done);assert.ok(state.clients[0].products.find(p=>p.id==='old').archived);
  assert.equal(state.clients[0].products.find(p=>p.id==='new').archived,undefined);
  if(legacy)assert.equal(state.clients[0].decisions[0].tasks.cancelCheck.file.name,'prior-cancellation.txt');
  await page.reload();await page.getByRole('button',{name:'לקוחות',exact:true}).click();await page.getByRole('button',{name:'פתיחת תיק',exact:true}).click();await page.getByRole('button',{name:/ביצוע ומעקב/}).click();
  await page.locator('.wf-followup').getByText('מסירת מסמכי הביצוע ללקוח',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await context.close();
 }
 console.log('PASS UI: new and legacy records; one cancellation; early close; reused evidence; persisted reload; no live writes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
