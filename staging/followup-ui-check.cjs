// Synthetic browser only: all requests intercepted; no email or calendar writes.
const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const {makeClient}=await import('../.local-preview/workflow-model.js');
 const pension=process.argv.includes('--pension');
 const deposit=process.argv.includes('--deposit');
 const c=makeClient({name:'בדיקת סיום',identity:'123456789',phone:'0500000000'});c.products=[{id:'p',category:'פנסיה',company:'הראל',policy:'123456789'}];c.summarySent=true;
 c.appointments=[{id:'annual',annualService:true,title:'פגישת שירות',type:'פגישת שירות',when:'2027-09-29T13:00',done:false}];
 c.decisions=[{id:'d',productId:'p',action:'ניוד קרן פנסיה בהתאם לסיכום',produced:true,fundsConfirmed:true,tasks:{verify:{done:true}},transfer:{document:{name:'transfer.txt',data:'data:text/plain,test'}}}];
 if(pension){const {recordSmsKit}=await import('../.local-preview/workflow-process.js');const d=c.decisions[0];Object.assign(d,recordSmsKit(d),{produced:false,sourceBalance:1000,transfer:{...d.transfer,inactive:true,verified:true,received:1000}});c.products[0].balance=1000;Object.assign(d,{target:"הראל",depositFee:1,balanceFee:0.1,track:"מניות"});}else{c.products[0].category='השתלמות';c.decisions[0].action='ניוד קרן השתלמות בהתאם לסיכום';}
 if(deposit){const {recordSmsKit}=await import('../.local-preview/workflow-process.js');const d=c.decisions[0];Object.assign(d,recordSmsKit(d),{produced:false,fundsConfirmed:false,sourceBalance:1000,transfer:{inactive:false,requiresDeposit:true,payrollSent:true,payrollDelivery:{sent:true},payrollSentAt:'2026-08-29',salary:10000,employee:6,employer:6.5,severance:6}});}
 if(!pension&&!deposit){
  // A legacy checkbox alone must not bypass interactive production verification.
  const d=c.decisions[0];Object.assign(d,{productCategory:'השתלמות',target:'הראל',depositFee:0,balanceFee:0.5,track:'מניות',transfer:{...d.transfer,received:1000}});
  const {recordProductionVerification}=await import('../.local-preview/production-verification.js');
  Object.assign(d,recordProductionVerification(d,{source:'company_document',reference:'Synthetic verified transfer document',values:{company:'הראל',depositFee:0,balanceFee:0.5,track:'מניות',received:1000,effective:'2026-09-01',policy:'TEST-123'}}));
 }
 c.products.push({id:'unchanged',category:'בריאות',company:'חברה ללא שינוי',policy:'UNCHANGED-123'});
 if(deposit)for(const key of ['employee','employer','severance'])delete c.decisions[0].transfer[key];
 c.decisions.push({id:'unchanged-decision',productId:'unchanged',action:'להשאיר ללא שינוי'});
 let state={clients:[c],selected:c.id,deletedClients:[]},revision=1,sends=0,events=0,fail=true;const errors=[];
 const root=path.resolve(__dirname,'../.staging-release/frontend/dist'),browser=await chromium.launch({channel:'chrome',headless:true});
 try{const page=await browser.newPage({serviceWorkers:'block'});page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('token','synthetic'));
 await page.route('**/*',async route=>{const url=new URL(route.request().url()),p=url.pathname;if(url.hostname!=='networth.test')return route.abort();
 if(p.startsWith('/api/')){let data={};if(p==='/api/auth/me')data={id:'synthetic',email:'staging-admin@example.invalid'};
 if(p==='/api/staging/crm'){if(route.request().method()==='PUT'){state=route.request().postDataJSON().state;revision++;}data={state,revision};}
 if(p==='/api/staging/calendar')data={ready:true,connected:true,events:[]};
 if(p==='/api/staging/calendar/events'){events++;data={url:'https://calendar.google.com/calendar/event?eid=test'};}
 if(p==='/api/staging/mail/delivery'){sends++;if(fail)return route.fulfill({status:400,json:{error:'שליחת בדיקה נכשלה'}});data={sent:true,messageId:'test',recipient:'davidsdreams55@gmail.com'};}
 return route.fulfill({json:data});}
 const file=p.startsWith('/assets/')||p.startsWith('/sandbox-')||p.endsWith('.png')?path.join(root,p):path.join(root,'index.html');return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':undefined});});
 await page.goto('https://networth.test/admin/crm');await page.getByRole('button',{name:'לקוחות',exact:true}).click();await page.getByRole('button',{name:'פתיחת תיק',exact:true}).click();await page.getByRole('button',{name:/ביצוע ומעקב/}).click();
 assert.equal(await page.getByText('UNCHANGED-123',{exact:false}).count(),0);
 assert.ok(state.clients[0].products.some(p=>p.id==='unchanged'));
 if(deposit){
  assert.equal(await page.getByLabel('אחוז עובד',{exact:true}).inputValue(),'6');
  assert.equal(await page.getByLabel('אחוז מעסיק',{exact:true}).inputValue(),'6.5');
  assert.equal(await page.getByLabel('אחוז פיצויים',{exact:true}).inputValue(),'6');
  await page.getByLabel('אחוז עובד',{exact:true}).fill('7');
  assert.equal(await page.getByLabel('אחוז עובד',{exact:true}).inputValue(),'7');
  await page.getByLabel('אחוז עובד',{exact:true}).fill('6');
  await page.getByLabel('סכום שהופקד בפועל',{exact:true}).fill('1700');
  await page.getByLabel('תאריך קבלת ההפקדה',{exact:true}).fill('2026-09-29');
  await page.getByRole('button',{name:'שמירת הפקדה ופתיחת בירור פער',exact:true}).click();
  await page.getByText('משימה פתוחה: בירור פער בהפקדה',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'אימות כספי הניוד',exact:true}).count(),0);
  await page.getByLabel('תוצאת הבירור ואסמכתה',{exact:true}).fill('נבדק מול חשבת השכר — הפרש מוסבר');
  await page.getByRole('button',{name:'תיעוד פתרון וסגירת הבירור',exact:true}).click();
  await page.getByRole('button',{name:'אימות כספי הניוד',exact:true}).waitFor();
  await page.getByRole('status').filter({hasText:'כל השינויים נשמרו'}).waitFor();assert.ok(state.clients[0].decisions[0].transfer.depositResolution.includes('הפרש מוסבר'));
  assert.equal(sends,0);assert.deepEqual(errors,[]);
  console.log('PASS: 1850/1700 remains at deposit, records gap, explanation unlocks transfer; no live writes.');return;
 }
 if(pension){assert.equal(await page.getByRole('button',{name:'דימוי חוסרים',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'שליחת מסמך הניוד למייל הבדיקה'}).count(),0);assert.ok(await page.getByRole('button',{name:'עדכנתי את הלקוח — סיום ניוד הפנסיה'}).isDisabled());for(const [label,value]of [['הגוף המנהל','הראל'],['דמי ניהול מהפקדה (%)','1'],['דמי ניהול מצבירה (%)','0.1'],['מסלול השקעה','מניות'],['סכום שהתקבל (₪)','1000'],['תאריך קליטה בפועל','2026-09-01']])await page.getByLabel(label,{exact:true}).fill(value);await page.getByRole('button',{name:'שמירת בדיקת ההפקה',exact:true}).click();await page.getByText('פרטי ההפקה נבדקו ונשמרו.',{exact:true}).waitFor();await page.getByRole('button',{name:'עדכנתי את הלקוח — סיום ניוד הפנסיה'}).click();await page.getByText('הלקוח עודכן והתהליך נסגר.',{exact:true}).waitFor();await page.getByRole('status').filter({hasText:'כל השינויים נשמרו'}).waitFor();assert.ok(state.clients[0].decisions[0].completed);assert.equal(sends,0);assert.deepEqual(errors,[]);console.log('PASS: pension completion UI only, no company buttons or mail, client update closes product.');return;}
 const button=page.getByRole('button',{name:'שליחת מסמך הניוד למייל הבדיקה'});await page.getByRole('status').filter({hasText:'כל השינויים נשמרו'}).waitFor();await button.click();await page.getByText('שליחת בדיקה נכשלה',{exact:true}).waitFor();assert.ok(!state.clients[0].decisions[0].tasks.deliver);
 fail=false;await button.click();try{await page.getByText('מתי התקיימה שיחת הטלפון?',{exact:true}).waitFor({timeout:5000});}catch(e){console.log(await page.locator('.wf-followup').innerText(),JSON.stringify(errors));throw e;}await page.getByRole('status').filter({hasText:'כל השינויים נשמרו'}).waitFor();assert.equal(state.clients[0].decisions[0].tasks.deliver.delivery.sent,true);assert.equal(sends,2);assert.equal(events,1);assert.deepEqual(errors,[]);
 console.log('PASS: annual appointment sync once; failed delivery stays open; confirmed delivery advances to phone call; no live requests.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
