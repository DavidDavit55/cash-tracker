import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseHarBituach, groupHarBituachByPolicy } from '../src/lib/harBituachParser.js';
import { portfolio } from '../src/sandbox/model.js';

test('zero-premium collective health survives workbook parsing and client portfolio', () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['', 'תחום - בריאות ותאונות אישיות'],
    ...['השתלות', 'תרופות - בסיס', 'אמבולטורי אחר'].map(product =>
      ['123456782', 'ביטוח בריאות', 'חבילת כיסויים', product, 'הפניקס', '', '', 0, 'חודשית', '1234567890', 'קבוצתי']),
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'תיק ביטוחי');
  const cards = groupHarBituachByPolicy(parseHarBituach(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })));
  const { policies } = portfolio({ har_bituach_data: cards });
  assert.equal(policies.length, 1);
  assert.equal(policies[0].type, 'health');
  assert.equal(policies[0].monthlyPremium, 0);
  assert.equal(policies[0].isCollective, true);
  assert.equal(policies[0].coverageItems.length, 3);
});

test('individual health is not labelled collective; HMO and collective labels are retained', () => {
  for (const classification of ['אישי', 'קבוצתי דרך קופת חולים', 'קולקטיב']) {
    const [card] = groupHarBituachByPolicy([{ policyNum: 'test', branch: 'ביטוח בריאות', company: 'הפניקס', classification, premium: '0' }]);
    assert.equal(card.isCollective, classification !== 'אישי');
    assert.equal(card.groupClassification, classification === 'אישי' ? null : classification);
  }
});
