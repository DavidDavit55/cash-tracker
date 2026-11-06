import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { createRequire } from 'node:module';
import JSZip from '../frontend/node_modules/jszip/lib/index.js';
import { prepareMaslakaUpload } from './maslaka-upload-owner.js';
import { parseHarBituach, groupHarBituachByPolicy } from '../frontend/src/lib/harBituachParser.js';
// XML-only test adapter: avoids the CSS/browser dependencies of jsdom.
// Browser rendering and file selection must still be checked separately.
const require = createRequire(import.meta.url);
const xml = require('C:/Users/david/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/xml-js');
class XmlNode {
  constructor(raw, parent = null) {
    this.raw = raw; this.parentElement = parent;
    this.children = (raw.elements || []).filter(n => n.type === 'element').map(n => new XmlNode(n, this));
    this.localName = this.tagName = raw.name;
  }
  get textContent() { return (this.raw.elements || []).map(n => n.text || n.cdata || '').join('') + this.children.map(n => n.textContent).join(''); }
  getElementsByTagName(tag) { return this.children.flatMap(n => [...(n.tagName === tag ? [n] : []), ...n.getElementsByTagName(tag)]); }
  querySelector(tag) { return this.getElementsByTagName(tag)[0] || null; }
  get documentElement() { return this.children[0]; }
  remove() { this.parentElement.children = this.parentElement.children.filter(n => n !== this); }
  serialize() { return { ...this.raw, elements: [...(this.raw.elements || []).filter(n => n.type !== 'element'), ...this.children.map(n => n.serialize())] }; }
}
globalThis.DOMParser = class { parseFromString(text) { try { return new XmlNode(xml.xml2js(text)); } catch { return new XmlNode({ elements: [{ type: 'element', name: 'parsererror' }] }); } } };
globalThis.XMLSerializer = class { serializeToString(node) { return xml.js2xml(node.serialize()); } };
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('./') && !specifier.endsWith('.js')) return next(specifier + '.js', context); throw error; }
} });
const { parseMaslakaFiles } = await import('../frontend/src/lib/maslakaParser.js');
const owner = id => `<YeshutLakoach><MISPAR-ZIHUY-LAKOACH>${id}</MISPAR-ZIHUY-LAKOACH></YeshutLakoach>`;
const insured = id => `<PirteiMevutach><MISPAR-ZIHUY-LAKOACH>${id}</MISPAR-ZIHUY-LAKOACH></PirteiMevutach>`;
const policy = ids => `<HeshbonOPolisa><MISPAR-POLISA-O-HESHBON>test</MISPAR-POLISA-O-HESHBON>${ids.map(insured).join('')}</HeshbonOPolisa>`;
const file = body => ({ name: 'testING.xml', text: `<Root>${body}</Root>` });
assert.equal(prepareMaslakaUpload([file(owner('000123') + policy(['123']))], '123').excludedPolicies.length, 0);
assert.equal(prepareMaslakaUpload([file(owner('123') + policy([]))], '123').excludedPolicies.length, 0);
for (const ids of [['123', '456'], ['456'], ['']]) {
  const result = prepareMaslakaUpload([file(owner('123') + policy(ids))], '123');
  assert.equal(result.excludedPolicies.length, 1);
  assert.ok(!result.files[0].text.includes('HeshbonOPolisa'));
}
for (const body of [policy(['123']), owner('456'), owner('123') + owner('456'), owner('')]) {
  assert.throws(() => prepareMaslakaUpload([file(body)], '123'));
}
assert.throws(() => prepareMaslakaUpload([file(owner('123')), file(owner('456'))], '123'));
assert.throws(() => prepareMaslakaUpload([{ name: 'bad.xml', text: '<bad>' }], '123'));
const primary=`<YeshutLakoach><MISPAR-ZIHUY-LAKOACH>123</MISPAR-ZIHUY-LAKOACH><SHEM-PRATI>לקוח</SHEM-PRATI><SHEM-MISHPACHA>בדיקה</SHEM-MISHPACHA><TAARICH-LEYDA>20000102</TAARICH-LEYDA><E-MAIL>OWNER@example.invalid</E-MAIL><Agent><E-MAIL>agent@example.invalid</E-MAIL></Agent></YeshutLakoach>`;
const checkedProfile=prepareMaslakaUpload([file(primary)],'123');
assert.deepEqual(checkedProfile.customerEmails,['owner@example.invalid']);
assert.equal(checkedProfile.customerProfile.name,'לקוח בדיקה');
assert.equal(checkedProfile.customerProfile.birth,'2000-01-02');
assert.equal(prepareMaslakaUpload([file(primary.replace('20000102','20000231'))],'123').customerProfile.birth,undefined);
console.log('PASS: primary identity, padded IDs, mixed/foreign/unknown insured quarantine, missing/mixed/wrong owners, malformed XML');
const [zipPath, excelPath] = process.argv.slice(2);
if (zipPath && excelPath) {
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  const files = await Promise.all(Object.values(zip.files).filter(e => !e.dir && /\.xml$/i.test(e.name)).map(async e => ({ name: e.name, text: await e.async('string') })));
  const rows = parseHarBituach(await readFile(excelPath));
  const ids = [...new Set(rows.map(r => String(r.tz).replace(/^0+(?=\d)/, '')))];
  assert.equal(ids.length, 1);
  const prepared = prepareMaslakaUpload(files, ids[0]);
  const parsed = parseMaslakaFiles(prepared.files, { includeEmptyAccounts: true });
  const policies = ['pension','study_fund','insurance','managers_insurance'].flatMap(key => parsed[key]);
  assert.ok(policies.length > 0);
  assert.equal(prepared.excludedPolicies.length, 1);
  assert.ok(!policies.some(p => prepared.excludedPolicies.some(e => e.policy === p.policyNum)));
  assert.throws(() => prepareMaslakaUpload(files, '000000018'));
  const grouped = [...new Set(rows.map(r => r.company))].flatMap(c => groupHarBituachByPolicy(rows.filter(r => r.company === c)));
  console.log(JSON.stringify({ xmlFiles: files.length, safeMaslakaProducts: policies.length, reviewPolicies: prepared.excludedPolicies.length, harCoverageRows: rows.length, harPolicies: grouped.length, identityMatches: true }));
}
