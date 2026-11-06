// Fully intercepted synthetic browser: no real CRM, mail, calendar or SMS requests.
const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const {makeClient}=await import('../.local-preview/workflow-model.js');const {recordSmsKit}=await import('../.local-preview/workflow-process.js');
 const file={name:'synthetic-policy.txt',data:'data:text/plain,SYNTHETIC'};
 const c=makeClient({name:'בדיקת הפקת חיים',identity:'123456789',phone:'0500000000'});c.call='בוצעה';c.summarySent=true;c.meetingDone=true;
 c.products=[{id:'p',category:'ביטוח חיים',company:'כלל',policy:'OLD',premium:150}];
 const d={id:'d',productId:'p',productCategory:'ביטוח חיים',action:'החלפת מוצר קיים — שחלוף בהתאם לסיכום',target:'מגדל',targetPremium:85,targetCoverage:500000,agreedCoverage:'מוות מכל סיבה',agreedExclusions:'ללא החרגות',agreedBeneficiaries:'בן זוג 100%',agreedEffective:'2099-08-01',policy:'NEW',effective:'2026-08-01',approved:true,evidence:'company evidence',cancelAnnex:'ג',policyDocument:file,messagePrepared:true};Object.assign(d,recordSmsKit(d,'2026-07-01T10:00:00Z'));c.decisions=[d];
 let state={clients:[c],selected:c.id,deletedClients:[]},revision=1;const errors=[],externalWrites=[];
 const root=path.resolve(__dirname,'../.staging-release/frontend/dist'),browser=await chromium.launch({channel:'chrome',headless:true});
 try{const page=await browser.newPage({serviceWorkers:'block'});page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('token','synthetic'));
 await page.route('**/*',async route=>{const request=route.request(),url=new URL(request.url()),p=url.pathname;if(url.hostname!=='networth.test')return route.abort();
 if(p.startsWith('/api/')){let data={};if(p==='/api/auth/me')data={id:'synthetic',email:'staging-admin@example.invalid'};
 if(p==='/api/staging/crm'){if(request.method()==='PUT'){state=request.postDataJSON().state;revision++;}data={state,revision};}
 if(p==='/api/staging/calendar')data={ready:false,connected:false,events:[]};
 if(p.includes('/mail/')||p==='/api/staging/calendar/events')externalWrites.push(p);
 return route.fulfill({json:data});}
 const f=p.startsWith('/assets/')||p.startsWith('/sandbox-')||p.endsWith('.png')?path.join(root,p):path.join(root,'index.html');return route.fulfill({path:f,contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':undefined});});
 await page.goto('https://networth.test/admin/crm');await page.getByRole('button',{name:'לקוחות',exact:true}).click();await page.getByRole('button',{name:'פתיחת תיק',exact:true}).click();await page.getByRole('button',{name:/ביצוע ומעקב/}).click();
 const verify=page.getByRole('region',{name:'בדיקת פרטי הפקה אינטראקטיבית'});
 await verify.waitFor();assert.equal(await verify.getByLabel('פרמיה חודשית (₪)',{exact:true}).inputValue(),'','actual values must not be copied from agreed');
 const save=verify.getByRole('button',{name:'שמירת בדיקת ההפקה',exact:true});assert.ok(await save.isDisabled());
 for(const [label,value]of [['החברה / הגוף המנהל','מגדל'],['פרמיה חודשית (₪)','86'],['סכום הביטוח (₪)','500000'],['החרגות ותנאי קבלה','ללא החרגות'],['מוטבים וחלקיהם לפי הוראות הלקוח','בן זוג 100%'],['תאריך תחילת הביטוח','2099-08-01'],['מספר חשבון / פוליסה בפועל','NEW']])await verify.getByLabel(label,{exact:true}).fill(value);
 await verify.getByRole('combobox').selectOption('company_site');await verify.getByLabel('על סמך איזה מסמך או מידע בדקת?',{exact:true}).fill('site policy 1');assert.ok(await save.isDisabled(),'mismatch premium remains blocked');
 await verify.getByLabel('פרמיה חודשית (₪)',{exact:true}).fill('85');assert.ok(await save.isEnabled());await save.click();await page.getByText('הנתונים נבדקו ונשמרו. ניתן להמשיך לקליטת המוצר.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'עדכון המוצר בתיק והמשך לסגירה',exact:true}).click();await page.getByText('מעקב ואישור ביטול הפוליסה הישנה',{exact:true}).first().waitFor();
 await page.getByRole('status').filter({hasText:'כל השינויים נשמרו'}).waitFor();assert.ok(state.clients[0].decisions[0].produced);assert.ok(state.clients[0].decisions[0].tasks.verify.done);assert.equal(state.clients[0].products[0].archived,undefined);assert.equal(state.clients[0].products[1].beneficiaries,'בן זוג 100%');assert.equal(state.clients[0].products[1].premium,85);
 await page.reload();await page.getByRole('button',{name:'לקוחות',exact:true}).click();await page.getByRole('button',{name:'פתיחת תיק',exact:true}).click();await page.getByRole('button',{name:/ביצוע ומעקב/}).click();assert.equal(await page.getByRole('region',{name:'בדיקת פרטי הפקה אינטראקטיבית'}).count(),0,'saved verified production not requested again');assert.deepEqual(errors,[]);assert.deepEqual(externalWrites,[]);
 console.log('PASS: production actual fields blank; mismatch blocks; life beneficiary checked; actual values persisted; no duplicate verify after reload; old policy retained; no external writes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
