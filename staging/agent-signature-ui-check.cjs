// Isolated browser regression: synthetic CRM only, every network request intercepted.
const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const {makeClient}=await import('../.local-preview/workflow-model.js');
 const root=path.resolve(__dirname,process.env.STAGING_TEST_DIST||'../.release/staging-20261004-candidate/frontend/dist');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const scenario of ['shared','legacy','meeting','payroll']){
   const c=makeClient({name:'בדיקת חתימה סינתטית',identity:'012345678',phone:'0500000000',source:'בדיקה'});
   c.call='yes';c.summarySent=true;c.meetingDone=true;c.products=[{id:'a',category:'השתלמות',company:'הפניקס',policy:'TEST-A',track:'כללי',balanceFee:0.4},{id:'b',category:'השתלמות',company:'הראל',policy:'TEST-B',balanceFee:0.5}];
   const base={signatureSent:true,signatureSentAt:'2026-01-01T12:00:00Z',signatureBatchId:'batch',signatureMessageSentAt:'2026-01-01T13:00:00Z',productCategory:'השתלמות'};
   c.decisions=[{...base,id:'da',productId:'a',action:'מינוי סוכן וביצוע השינויים שבסיכום',track:'מניות',balanceFee:0.4,feeChangeRequested:false},{...base,id:'db',productId:'b',action:'מינוי סוכן ללא שינוי בתנאים'}];
   if(scenario==='legacy'){
    const {recordExternalKit}=await import('../.local-preview/workflow-process.js');
    c.decisions=c.decisions.map(d=>({...d,signatureBatchId:undefined}));
    Object.assign(c.decisions[0],recordExternalKit(c.decisions[0],{date:'2026-01-02',identityAttached:true}));
   }
   if(scenario==='meeting'){c.summarySent=false;c.decisions=[];}
   if(scenario==='payroll'){
    const {recordExternalKit}=await import('../.local-preview/workflow-process.js');
    c.products=[{...c.products[0],category:'פנסיה',balance:10000}];
    const d={...base,id:'da',productId:'a',action:'ניוד קרן פנסיה בהתאם לסיכום',productCategory:'פנסיה',target:'הפניקס'};
    c.decisions=[{...d,...recordExternalKit(d,{date:'2026-01-02',identityAttached:true}),transfer:{inactive:false,payrollSent:true,payrollSentAt:'2026-01-05',payrollDelivery:{id:'test'}}}];
   }
   let state={clients:[c],selected:c.id},revision=1;const errors=[],writes=[];
   const page=await browser.newPage({serviceWorkers:'block',viewport:{width:1440,height:1050}});
   page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('token','synthetic'));
   await page.route('**/*',async route=>{
    const u=new URL(route.request().url()),p=u.pathname;if(u.hostname!=='networth.test')return route.abort();
    if(p.startsWith('/api/')){
     let data={};if(route.request().method()!=='GET')writes.push(p);
     if(p==='/api/auth/me')data={id:'test',email:'staging-admin@example.invalid'};
     if(p==='/api/staging/crm'){if(route.request().method()==='PUT'){state=route.request().postDataJSON().state;revision++;}data={state,revision};}
     return route.fulfill({json:data});
    }
    const file=p.startsWith('/assets/')||p.startsWith('/sandbox-')||p.endsWith('.png')?path.join(root,p):path.join(root,'index.html');
    return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':undefined});
   });
   async function saved(){await page.waitForFunction(()=>document.querySelector('.staging-toolbar')?.textContent.includes('כל השינויים נשמרו'));}
   async function open(tab){await page.getByRole('button',{name:'לקוחות',exact:true}).click();await page.getByRole('button',{name:'פתיחת תיק',exact:true}).click();await page.getByRole('button',{name:new RegExp('^'+tab)}).click();}
   await page.goto('https://networth.test/admin/crm');await open(scenario==='meeting'?'פגישה וסיכום':'ביצוע ומעקב');
   if(scenario==='shared'){
    assert.equal(await page.getByRole('heading',{name:'בדיקת ביצוע שינוי מסלולי השקעה',exact:true}).count(),0);
    const op=page.locator('.wf-operation').first();await op.getByLabel('תאריך חתימת הלקוח בפועל').fill('2026-01-02');await op.getByRole('checkbox',{name:'צילום ת״ז צורף לטפסים'}).check();await op.getByRole('button',{name:'תיעוד חתימה והמשך למעקב'}).click();await saved();
    assert.ok(state.clients[0].decisions.every(d=>d.signed&&d.sent&&d.sms2010.sentDate==='2026-01-02'));
    assert.equal(await page.getByRole('heading',{name:'בדיקת ביצוע שינוי מסלולי השקעה',exact:true}).count(),0);
    await page.reload();await open('ביצוע ומעקב');assert.equal(await page.getByLabel('תאריך חתימת הלקוח בפועל').count(),0);
    const appointment=page.locator('.wf-operation').first();await appointment.getByLabel('תאריך בדיקת המינוי',{exact:true}).fill('2026-01-03');await appointment.getByLabel('תוצאת בדיקת המינוי').selectOption('accepted');await appointment.getByRole('button',{name:'שמירת בדיקת המינוי'}).click();await saved();
    assert.equal(await page.getByRole('heading',{name:'בדיקת ביצוע שינוי מסלולי השקעה',exact:true}).count(),1);
    assert.equal(await page.getByText('בקשת הנחה ואימות התנאים',{exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'עדכון המוצר בתיק והמשך לסגירה'}).count(),0);
    await page.screenshot({path:path.resolve(__dirname,'../.staging-private/agent-signature-ui.png'),fullPage:true});
   }else if(scenario==='legacy'){
    await page.getByText('החתימה כבר תועדה במוצר אחר באותו קיט?',{exact:true}).click();await page.getByLabel('חתימה קיימת').selectOption('da');
    const repair=page.locator('details').filter({has:page.getByLabel('חתימה קיימת')});await repair.getByRole('checkbox').check();await repair.getByRole('button',{name:'המוצרים המסומנים נחתמו יחד — עדכון התיעוד'}).click();await saved();assert.ok(state.clients[0].decisions.every(d=>d.signed&&d.sent));
   }else if(scenario==='payroll'){
    const form=page.locator('form').filter({has:page.getByRole('heading',{name:'וידוא אישור מחשבת השכר על עדכון ההפקדות',exact:true})});
    await form.locator('select[name="status"]').selectOption('received');await form.getByLabel('תאריך הבדיקה / התשובה').fill('2026-01-07');await form.getByLabel('תוכן התשובה ואסמכתה / תוצאת המעקב').fill('קיבלתי בלבד');await form.getByRole('button').click();await saved();assert.equal(state.clients[0].decisions[0].transfer.payrollReply.status,'received');
    await form.locator('select[name="status"]').selectOption('confirmed');await form.getByLabel('העדכון יחול מחודש שכר').fill('2026-01');await form.getByRole('button').click();await saved();assert.equal(state.clients[0].decisions[0].transfer.payrollReply.status,'confirmed');assert.equal(state.clients[0].decisions[0].transfer.depositDate,undefined);
    await page.reload();await open('ביצוע ומעקב');assert.equal(await page.getByRole('heading',{name:'וידוא אישור מחשבת השכר על עדכון ההפקדות',exact:true}).count(),0);assert.equal(await page.getByLabel('סכום שהופקד בפועל').count(),1);
   }else{
    const card=page.locator('[data-product-id="a"]');await card.locator('summary').click();await card.getByLabel('מה סוכם בפגישה').selectOption('מינוי סוכן וביצוע השינויים שבסיכום');
    assert.equal(await card.getByLabel('דמי ניהול מצבירה שסוכמו (%)',{exact:true}).count(),0);
    await card.getByLabel('שינויים נוספים שסוכמו (אם יש)').fill('עדכון מוטבים שסוכם');await card.getByRole('button',{name:'שמירת החלטה למוצר'}).click();await saved();assert.equal(state.clients[0].decisions[0].feeChangeRequested,false);
    if(!await card.getAttribute('open'))await card.locator('summary').click();await card.getByRole('checkbox',{name:'סוכמה בקשת הנחה בדמי ניהול',exact:true}).check();await card.getByLabel('דמי ניהול מצבירה שסוכמו (%)',{exact:true}).fill('0.25');await card.getByRole('button',{name:'שמירת החלטה למוצר'}).click();await saved();assert.equal(state.clients[0].decisions[0].feeChangeRequested,true);assert.equal(state.clients[0].decisions[0].balanceFee,'0.25');
   }
   assert.deepEqual(errors,[]);assert.ok(writes.every(p=>p==='/api/staging/crm'),'no external sends or Tasks writes');await page.close();
   console.log('PASS synthetic browser: '+scenario);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
