const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
const page=await browser.newPage({viewport:{width:1512,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5208/report-preview#new-lead');
await page.getByLabel('שם מלא',{exact:true}).fill('בדיקת קליטה מקומית');await page.getByLabel('טלפון',{exact:true}).fill('0500000044');await page.getByLabel('תעודת זהות',{exact:true}).fill('207224841');await page.getByRole('button',{name:'שמירת ליד',exact:true}).click();
for(const [label,file] of [['קובץ מסלקה (ZIP / XML)','מסלקה_אבי אברהם בן חמו.zip'],['קובץ הר הביטוח (Excel)','HbResults-2026-02-12_10-11-47-AM.xlsx']]){
 await page.getByRole('button',{name:'העלאת מסלקה / הר הביטוח',exact:true}).click();await page.getByLabel(label,{exact:true}).setInputFiles('C:/Users/david/Downloads/'+file);
 await page.getByText('הקובץ מתאים לת״ז שבתיק',{exact:true}).waitFor({timeout:30000});await page.getByRole('button',{name:'אישור קליטה לתיק',exact:true}).click();
}
assert.deepEqual(await page.locator('.wf-product-group>h2').allTextContents(),['פנסיה (3)','השתלמות (4)','ביטוח חיים (1)','בריאות (1)','תאונות אישיות (1)','מחלות קשות (1)','סיעוד (1)']);
await page.screenshot({path:'C:/Users/david/.codex/visualizations/2026/09/27/01a0e296-a8a5-7691-873d-c13d6c84eec1/workflow-product-rows.png',fullPage:true});
await page.getByRole('button',{name:/טרם הושלמה הבדיקה · המלצות/}).first().click();await page.getByRole('button',{name:'נראה טוב — סמן פרמטרים שטרם נבדקו כמתאימים',exact:true}).click();
assert.ok(Object.keys(await page.evaluate(()=>JSON.parse(localStorage.getItem('networth-workflow-demo-v1')).clients[0].assessments)).length);
await page.screenshot({path:'C:/Users/david/.codex/visualizations/2026/09/27/01a0e296-a8a5-7691-873d-c13d6c84eec1/workflow-native-recommendations.png',fullPage:true});
assert.equal(await page.locator('.wf-tabs').getByRole('button',{name:'המלצות',exact:true}).count(),0);
assert.equal(await page.locator('.wf-tabs').getByRole('button',{name:'מוצרים והמלצות',exact:true}).count(),1);
await page.reload();await page.getByRole('button',{name:'מוצרים והמלצות',exact:true}).click();assert.equal(await page.getByRole('button',{name:/נבדק ונמצא מתאים · המלצות/}).count(),1);
await page.getByRole('button',{name:'פגישה וסיכום',exact:true}).click();await page.getByLabel('מה הלקוח אישר בפגישה').first().selectOption('להשאיר ללא שינוי');await page.getByRole('button',{name:'שמירת החלטה למוצר',exact:true}).first().click();
assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('networth-workflow-demo-v1')).clients[0].decisions[0].recommendation));
const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('networth-workflow-demo-v1')));const c=state.clients[0];
console.log('Parsed categories:',c.products.map(p=>p.category));assert.equal(c.products.length,12);assert.equal(c.products.filter(p=>p.policy==='14781014').length,1);assert.equal(c.products.find(p=>p.policy==='14781014').premium,27.45);assert.equal(c.reports.length,2);
await page.getByRole('button',{name:'+ התחלה חדשה / ליד חדש',exact:true}).click();await page.getByLabel('שם מלא',{exact:true}).fill('תיק שני');await page.getByLabel('טלפון',{exact:true}).fill('0500000045');await page.getByLabel('תעודת זהות',{exact:true}).fill('000000018');await page.getByRole('button',{name:'שמירת ליד',exact:true}).click();
await page.getByRole('button',{name:'העלאת מסלקה / הר הביטוח',exact:true}).click();await page.getByLabel('קובץ הר הביטוח (Excel)',{exact:true}).setInputFiles('C:/Users/david/Downloads/HbResults-2026-02-12_10-11-47-AM.xlsx');await page.getByRole('alert').filter({hasText:'אינו שייך'}).waitFor();
assert.equal(await page.getByRole('button',{name:'אישור קליטה לתיק'}).count(),0);await page.getByRole('button',{name:'סגירה',exact:true}).click();await page.reload();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('networth-workflow-demo-v1')).clients.length),2);assert.deepEqual(errors,[]);console.log('PASS: two actual reports, dedup, fresh lead, preserved clients, wrong identity blocked, reload');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
