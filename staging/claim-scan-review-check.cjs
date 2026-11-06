const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
const p=await b.newPage();await p.goto('http://127.0.0.1:5240/claim-scan-test.html');await p.locator('summary').click();
await p.locator('input[type=file]').setInputFiles({name:'private-check.png',mimeType:'image/png',buffer:fs.readFileSync('tmp/pdfs/psychiatrist-check/page-2.png')});
await p.getByText('הסריקה הסתיימה.',{exact:false}).waitFor({timeout:180000});
await p.locator('input[type=checkbox]').first().check();const inputs=p.locator('input:not([type=file]):not([type=checkbox])');
for(const [i,value] of ['847','ייעוץ','רופא סינתטי','test-3590','05.05.2026','600'].entries())await inputs.nth(i).fill(value);
await p.locator('input[type=checkbox]').nth(1).check();await p.locator('input[type=checkbox]').nth(2).check();await p.getByRole('button',{name:'אישור ושמירת פרטי החשבוניות לתביעה'}).click();
const tasks=await p.evaluate(()=>window.saved);assert.equal(tasks[0].claimScan.total,600);assert.equal(tasks[0].status,'open');assert.equal(tasks[0].claimScan.sourceStored,false);assert.equal('text' in tasks[0].claimScan,false);console.log('PASS scanned receipt processed locally; review/save synthetic fields; no raw medical text persisted.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
