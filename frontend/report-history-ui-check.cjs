// Local browser test. Every API call is intercepted; no live database is accessed.
const { chromium } = require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { readFile } = require('node:fs/promises');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ root: __dirname, configLoader: 'native', server: { host: '127.0.0.1', port: 5208, strictPort: true } });
  await server.listen();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const [harPath, maslakaPath, screenshotPath] = process.argv.slice(2);
  const records = []; const errors = []; let posts = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    page.on('pageerror', error => errors.push(error.message));
    let subjectId = '';
    await page.addInitScript(() => localStorage.setItem('token', 'local-test-only'));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) {
        let data = {};
        if (url.pathname.endsWith('/auth/me')) data = { id: 'admin', email: 'david@davit-fin.co.il', name: 'בדיקה מקומית' };
        else if (url.pathname === '/api/admin/clients') data = [{ id: 'client-test', name: 'אבי — בדיקה מקומית בלבד', id_number: subjectId }, { id: 'other-test', name: 'לקוח אחר לבדיקה', id_number: '123456782' }];
        else if (url.pathname.endsWith('/reports')) {
          if (route.request().method() === 'POST') {
            posts++;
            const form = await new Response(route.request().postDataBuffer(), { headers: { 'Content-Type': route.request().headers()['content-type'] } }).formData();
            const report = JSON.parse(form.get('report'));
            records.unshift({ id: String(posts), source: report.source, as_of_date: report.asOfDate, issued_on: report.issuedOn, filename: form.get('file').name, received_at: new Date().toISOString(), payload: report });
            data = { id: String(posts) };
          } else data = records;
        } else if (url.pathname.startsWith('/api/client-profile')) data = null;
        else return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      }
      if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') return route.abort();
      return route.continue();
    });
    await page.goto('http://127.0.0.1:5208/import');
    const bytes = Array.from(await readFile(harPath));
    subjectId = await page.evaluate(async data => {
      const { parseHarBituach } = await import('/src/lib/harBituachParser.js');
      return parseHarBituach(new Uint8Array(data).buffer)[0].tz;
    }, bytes);
    await page.goto('http://127.0.0.1:5208/import');
    await page.getByRole('button', { name: 'תיקי לקוחות', exact: true }).click();
    await page.getByLabel('מקור הדוח').selectOption('har_bituach');
    await page.locator('input[type=file]').setInputFiles(harPath);
    await page.getByRole('heading', { name: /תצוגה מקדימה/ }).waitFor();
    assert.equal(posts, 0, 'preview must not save');
    assert.equal(await page.locator('input[type=date]').first().inputValue(), '2026-02-12');
    assert.equal(await page.locator('.report-table tbody tr').count(), 5);
    await page.getByRole('button', { name: 'אישור ושמירה בהיסטוריה בלבד' }).click();
    await page.getByLabel('תאריך הר הביטוח').waitFor();
    assert.equal(records[0].payload.harBituachData.find(p => p.id === '515583274').monthlyPremium, 68.58);
    await page.getByLabel('מקור הדוח').selectOption('maslaka');
    await page.locator('input[type=file]').setInputFiles(maslakaPath);
    await page.getByRole('heading', { name: /תצוגה מקדימה/ }).waitFor();
    assert.equal(await page.locator('input[type=date]').first().inputValue(), '2026-05-31');
    assert.equal(await page.locator('input[type=date]').nth(1).inputValue(), '2026-06-22');
    await page.getByRole('button', { name: 'אישור ושמירה בהיסטוריה בלבד' }).click();
    await page.getByLabel('תאריך מסלקה').waitFor();
    assert.equal(posts, 2);
    assert.equal(records[0].payload.pensionData.length + records[0].payload.insuranceData.length, 8, 'retain all source accounts including empty funds');
    // Real source view only; the dates below are not fabricated history.
    const history = page.locator('section.report-history').last();
    await page.addStyleTag({ content: '.app-header { visibility: hidden !important; }' });
    await history.evaluate(el => { const notice = document.createElement('p'); notice.textContent = 'בדיקה מקומית עם קובצי אבי — לא נשמר דבר בתיק החי. מועד הקליטה המוצג הוא זמן בדיקת הדפדפן.'; notice.style.cssText = 'background:#e5f2ff;padding:14px;border-radius:8px'; el.prepend(notice); });
    await history.scrollIntoViewIfNeeded();
    if (screenshotPath) await history.screenshot({ path: screenshotPath });
    // Add a clearly synthetic report in memory solely to verify independent selection.
    records.push({ ...records[0], id: 'older-test', as_of_date: '2025-01-31', filename: 'synthetic-test-only.xml', payload: { pensionData: [{ id: 'test-old', provider: 'בדיקה', name: 'מוצר היסטורי לבדיקה', balance: 5 }], insuranceData: [] } });
    await page.getByLabel('לקוח לדוח').selectOption('other-test');
    await page.getByLabel('לקוח לדוח').selectOption('client-test');
    await page.getByLabel('תאריך מסלקה').selectOption('older-test');
    await page.getByText('מוצר היסטורי לבדיקה', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('תאריך הר הביטוח').inputValue(), '1');
    assert.equal(posts, 2, 'changing dates must not save');
    await page.getByLabel('לקוח לדוח').selectOption('other-test');
    await page.getByLabel('מקור הדוח').selectOption('har_bituach');
    await page.locator('input[type=file]').setInputFiles(harPath);
    await page.getByText(/תעודת הזהות בדוח אינה תואמת/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'אישור ושמירה בהיסטוריה בלבד' }).count(), 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, sourceReports: 2, independentDateSelection: true, previewDoesNotSave: true, mismatchBlocked: true, screenshot: screenshotPath ? path.basename(screenshotPath) : null }));
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
