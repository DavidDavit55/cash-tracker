import test from 'node:test';
import assert from 'node:assert/strict';
import { portfolio } from '../src/sandbox/model.js';
const active = { id: 'same', provider: 'אלטשולר שחם', type: 'pension', status: 'פעיל', balance: 52000 };
const inactive = { id: 'same', provider: 'מנורה', type: 'pension', status: 'לא פעיל', balance: 66785 };
const review = funds => portfolio({ pension_data: funds }).recommendations.filter(r => r.kind === 'consolidation');
test('one review for funded inactive pensions and exactly one active pension, preserving same-ID companies', () => {
  const result = review([active, inactive, inactive, { ...inactive, provider: 'מיטב', balance: 0 }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].balance, 66785);
  assert.equal(result[0].inactive.length, 1);
  assert.equal(result[0].fund.provider, active.provider);
});
test('no review for empty, unknown, non-pension, or ambiguous active funds', () => {
  for (const funds of [[inactive], [active], [active, { ...inactive, balance: null }], [active, { ...inactive, status: '' }], [active, { ...inactive, type: 'study' }], [active, { ...active, provider: 'מיטב' }, inactive]]) assert.equal(review(funds).length, 0);
});
