// Isolated browser, synthetic data, all requests fulfilled locally. No Google/site writes.
const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const {makeClient}=await import('../.local-preview/workflow-model.js');
 const {appointmentSyncVersion}=await import('../.local-preview/appointment-edit.js');
 const {applyTaskCompletions,taskVersion}=await import('../.local-preview/task-sync.js');
 const root=path.resolve(process.env.STAGING_UI_DIST||path.join(__dirname,'../frontend/dist'));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const c=makeClient({name:'בדיקת יומן ומשימות',identity:'123456789'});c.call='Initial call';c.products=[{id:'p',category:'פנסיה',company:'חברה',policy:'TEST',coverage:[]}];
  c.appointments=[{id:'a',title:'פגישה לבדיקה',type:'המשך טיפול',when:'2026-10-04T13:00',done:false}];
  c.operationalTasks=[{id:'task',kind:'משימה אחרת',completionPolicy:'manual_internal',note:'Synthetic administrative task',status:'open',due:'2026-10-01',productId:'p'}];
  let state={clients:[c],selected:c.id},revision=1,calendarCalls=0,failCalendar=true,holdTasks=false,releaseTasks,taskCalls=0;
  const events=[{appointment_key:JSON.stringify([c.id,'a']),event_url:'https://calendar.google.com/calendar/event?eid=synthetic',source_version:appointmentSyncVersion(c,c.appointments[0]),sync_status:'active'}];
  const page=await browser.newPage({serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('token','synthetic'));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url()),p=u.pathname;if(u.hostname!=='networth.test')return route.abort();
   if(p.startsWith('/api/')){
    if(p==='/api/auth/me')return route.fulfill({json:{id:'test',email:'staging-admin@example.invalid'}});
    if(p==='/api/staging/crm'){
     if(route.request().method()==='PUT'){const body=route.request().postDataJSON();assert.equal(body.revision,revision,'queued drafts must use server Tasks revision');state=body.state;revision++;}
     return route.fulfill({json:{state,revision}});
    }
    if(p==='/api/staging/calendar')return route.fulfill({json:{connected:true,ready:true,events}});
    if(p==='/api/staging/calendar/events'){
     calendarCalls++;const body=route.request().postDataJSON(),client=state.clients[0],a=client.appointments[0];assert.equal(body.expectedVersion,appointmentSyncVersion(client,a));
     if(failCalendar){failCalendar=false;return route.fulfill({status:500,json:{error:'כשל בדיקה — יש לנסות שוב'}});}
     events[0]={...events[0],source_version:body.expectedVersion,sync_status:a.cancelled?'cancelled':'active'};
     return route.fulfill({json:{url:a.cancelled?undefined:events[0].event_url,cancelled:!!a.cancelled,sourceVersion:body.expectedVersion,revision}});
    }
    if(p==='/api/staging/tasks')return route.fulfill({json:{connected:true,ready:true}});
    if(p==='/api/staging/tasks/sync'){
     taskCalls++;let updates=[];
     if(holdTasks){holdTasks=false;await new Promise(r=>releaseTasks=r);const task=state.clients[0].operationalTasks[0];updates=[{clientId:c.id,taskId:'task',previousVersion:taskVersion(task),completedAt:'2026-09-30T10:00:00Z',remoteId:'google-task',auditId:'task-audit'}];state=applyTaskCompletions(state,updates);revision++;}
     return route.fulfill({json:{revision,completionUpdates:updates,imported:updates.length,open:state.clients[0].operationalTasks[0].status==='done'?0:1,undated:0}});
    }
    return route.fulfill({json:{}});
   }
   const file=p.startsWith('/assets/')||p.startsWith('/sandbox-')||p.endsWith('.png')?path.join(root,p):path.join(root,'index.html');return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':undefined});
  });
  await page.goto('https://networth.test/admin/crm');
  await page.getByRole('button',{name:'יומן עסקי',exact:true}).click();
  await page.getByRole('button',{name:'עריכה / ביטול פגישה',exact:true}).click();
  let editor=page.locator('dialog[open]');await editor.getByLabel('נושא',{exact:true}).fill('פגישה מעודכנת');await editor.getByLabel('תאריך ושעה').fill('2026-10-05T14:00');await editor.getByRole('button',{name:'שמירת שינויי הפגישה'}).click();
  await page.getByRole('button',{name:'יומן — נדרש טיפול'}).waitFor();assert.equal(state.clients[0].appointments[0].id,'a');assert.equal(state.clients[0].appointments.length,1);
  await page.getByRole('button',{name:'יומן — נדרש טיפול'}).click();await page.getByRole('link',{name:'נשמר בגוגל — פתיחת האירוע'}).waitFor();assert.equal(calendarCalls,2,'failed first attempt is retried automatically');await page.locator('dialog[open]').getByRole('button',{name:'סגירה',exact:true}).click();
  await page.getByRole('button',{name:'עריכה / ביטול פגישה',exact:true}).click();editor=page.locator('dialog[open]');await editor.getByRole('button',{name:'ביטול הפגישה',exact:true}).click();await editor.getByLabel('סיבת ביטול').fill('Synthetic cancellation');await editor.getByRole('button',{name:'אישור ביטול הפגישה'}).click();
  await page.waitForFunction(()=>!document.querySelector('.wf-dialog[open]'));for(let i=0;events[0].sync_status!=='cancelled'&&i<100;i++)await page.waitForTimeout(20);
  assert.equal(events[0].sync_status,'cancelled');assert.equal(calendarCalls,3);assert.equal(state.clients[0].appointments[0].history.length,2);await page.getByRole('button',{name:'היום שלי',exact:true}).click();await page.getByRole('heading',{name:'אין פגישה קרובה'}).waitFor();
  // Keep a local form and selected-client draft alive while Google completion returns.
  await page.getByRole('button',{name:'משימות מחוברות',exact:true}).waitFor();holdTasks=true;await page.getByRole('button',{name:'משימות מחוברות',exact:true}).click();await page.getByRole('button',{name:'סנכרון משימות עכשיו'}).click();
  for(let i=0;!releaseTasks&&i<100;i++)await page.waitForTimeout(20);assert.equal(typeof releaseTasks,'function');await page.locator('dialog[open]').getByRole('button',{name:'סגירה',exact:true}).click();
  await page.getByRole('button',{name:'לקוחות',exact:true}).click();await page.getByRole('button',{name:'פתיחת תיק',exact:true}).click();await page.getByRole('button',{name:'תיעוד שיחה',exact:true}).click();
  const note=page.locator('dialog[open] textarea[name="note"]');await note.fill('טיוטת שיחה נשמרת בזמן הסנכרון');releaseTasks();
  await page.waitForTimeout(700);assert.equal(await note.inputValue(),'טיוטת שיחה נשמרת בזמן הסנכרון');
  await page.getByRole('button',{name:'שמירת תיעוד ופגישה אם נקבעה'}).click();await page.waitForTimeout(700);assert.equal(state.clients[0].call,'טיוטת שיחה נשמרת בזמן הסנכרון');assert.equal(state.clients[0].operationalTasks[0].status,'done');assert.equal(state.clients[0].events.filter(e=>e.id==='task-audit').length,1);assert.deepEqual(errors,[]);
  await page.close();console.log('PASS: calendar edit/retry/cancel same event and safe Tasks refresh preserve in-progress forms; isolated mocked requests only.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
