// Read-only local source verification; nothing is uploaded to staging or Google.
const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const JSZip=require('../frontend/node_modules/jszip');
(async()=>{
 const zip=await JSZip.loadAsync(fs.readFileSync(process.argv[2]));
 const files=await Promise.all(Object.values(zip.files).filter(e=>!e.dir&&e.name.endsWith('.xml')).map(async e=>({name:e.name,text:await e.async('string')})));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:5218');
  const result=await page.evaluate(async ({files,modulePath})=>{
   const {processMaslakaFiles}=await import('/src/lib/maslakaCards.js');
   const {mergeReports}=await import(modulePath);
   const cards=processMaslakaFiles(files,{includeEmptyAccounts:true}).pensionCards.filter(p=>p.type==='pension');
   const report={id:'r',source:'maslaka',asOf:'2026-07-31',fingerprint:'test',cards};
   const empty={products:[],reports:[],decisions:[],identity:'',stage:'איסוף מידע'};
   const first=mergeReports(empty,[report]);
   const legacy={...first,products:first.products.filter(p=>/משלימה|כללית/.test(p.name)).map(p=>({...p,pensionIdentity:undefined,importKey:p.importKey.split(':pension:')[0],balance:null,note:'preserve'}))};
   legacy.decisions=[{productId:legacy.products[0].id,action:'test'}];
   const repaired=mergeReports(legacy,[report]),again=mergeReports(repaired,[report]);
   return {balances:cards.map(p=>p.balance).sort((a,b)=>a-b),count:first.products.length,repaired:repaired.products.length,again:again.products.length,stable:repaired.products.some(p=>p.id===legacy.decisions[0].productId&&p.note==='preserve'),reports:again.reports.length};
  },{files,modulePath:'/@fs/'+require('node:path').resolve(__dirname,'../.local-preview/workflow-upload.jsx').replaceAll('\\','/')});
  assert.deepEqual(result.balances,[2193.86,3017.83,177740.63,1242275.7]);
  assert.equal(result.count,4);assert.equal(result.repaired,4);assert.equal(result.again,4);assert.equal(result.reports,1);assert.equal(result.stable,true);
  console.log('PASS: four pension funds, exact balances, legacy re-import repair, stable product references and idempotence.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
