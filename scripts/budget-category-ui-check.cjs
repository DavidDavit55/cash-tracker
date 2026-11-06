const {chromium}=require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]);
const overview={expenses:[{id:'expense-1',amount:20,merchant:'Test merchant',expense_date:'2026-10-07',category_id:'used'}],incomes:[],budgets:[],bankMovements:[],categories:[{id:'used',name:'Existing category'},{id:'unused',name:'Unused category'}]};
const server=http.createServer((req,res)=>{
  const requested=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!requested.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  const file=fs.existsSync(requested)&&fs.statSync(requested).isFile()?requested:path.join(root,'index.html');
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>localStorage.setItem('token','synthetic-local-test'));
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.pathname.startsWith('/api/')){
        assert.equal(route.request().method(),'GET','No mutations allowed in this test');
        const data=url.pathname==='/api/auth/me'?{id:'test-user',email:process.env.BUDGET_RELEASE==='1'?'david@davit-fin.co.il':'test@example.invalid',name:'Test'}:url.pathname==='/api/budget-workspace/overview'?overview:[];
        return route.fulfill({json:data});
      }
      if(url.hostname==='127.0.0.1')return route.continue();
      return route.abort();
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/summary`);
    if(process.env.BUDGET_RELEASE==='1'){
      await page.locator('.budget-release').waitFor();
      assert.equal(await page.locator('.bw-transactions').count(),0);
      await page.getByRole('button',{name:'תנועות בקטגוריה Existing category',exact:true}).click();
      await page.locator('.preview-category-detail').waitFor();
      assert.match(await page.locator('.preview-category-detail').innerText(),/Test merchant/);
      await page.getByRole('button',{name:'תנועות',exact:true}).click();
    }
    const inline=page.getByLabel('קטגוריה עבור Test merchant',{exact:true});
    await inline.waitFor();assert.equal(await inline.locator('option[value="unused"]').count(),1);
    await page.getByRole('button',{name:'＋ תנועת מזומן',exact:true}).click();
    const cash=page.locator('form').filter({has:page.getByRole('button',{name:'שמירת תנועה',exact:true})});
    await cash.locator('select option[value="unused"]').waitFor({state:'attached'});
    assert.equal(await cash.locator('select option[value="unused"]').count(),1);
    await cash.getByRole('button',{name:'ביטול',exact:true}).click();
    await page.getByRole('button',{name:'עריכת תנועה Test merchant 2026-10-07',exact:true}).click();
    await page.locator('form select option[value="unused"]').waitFor({state:'attached'});
    assert.equal(await page.locator('form select option[value="unused"]').count(),1);
    if(process.env.BUDGET_DESIGN==='1'){
      await page.getByRole('button',{name:'ביטול עריכה',exact:true}).click();
      await page.getByRole('button',{name:'קטגוריות ותקציב',exact:true}).click();
      await page.getByRole('button',{name:'תנועות בקטגוריה Unused category',exact:true}).waitFor();
      assert.equal(await page.locator('.bw-transactions').count(),0);
      await page.getByRole('button',{name:'מבט חודשי',exact:true}).click();
      await page.locator('.bw-overview-grid').waitFor();
      await page.setViewportSize({width:1440,height:1000});
      if(process.env.BUDGET_RELEASE==='1'){
        const month=await page.locator('input[type=month]').boundingBox();
        const action=await page.getByRole('button',{name:'＋ תנועת מזומן',exact:true}).boundingBox();
        assert.ok(Math.abs(month.y-action.y)<2,'Month and actions align');
      }
      await page.screenshot({path:path.resolve('.release/budget-design-desktop.png'),fullPage:true});
      await page.setViewportSize({width:390,height:844});
      await page.screenshot({path:path.resolve('.release/budget-design-mobile.png'),fullPage:true});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page-level horizontal overflow');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: unused categories available in inline editing, cash entry and movement editor; zero API writes');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
