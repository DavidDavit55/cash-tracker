import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendationFor } from '../src/sandbox/model.js';
import { isAgeTrack, hasUnderperformance, comparableRows } from '../src/sandbox/recommendationRules.js';
import { classifyTrack } from '../src/sandbox/marketComparison.js';
test('fee reviews only above either pension threshold; no agency offer for other products', () => {
  const fund = { type: 'pension', balance: 1000, feeFromDeposit: 1.5, feeFromAccumulation: 0.15 };
  assert.equal(recommendationFor(fund, {}), null);
  assert.ok(recommendationFor({ ...fund, feeFromDeposit: 2 }, {}));
  const review = recommendationFor({ ...fund, feeFromDeposit: 1, feeFromAccumulation: 0.22 }, {});
  assert.equal(review.offer.feeFromDeposit, 1.5);
  assert.ok(review);
  assert.equal(recommendationFor({ ...fund, type: 'study', feeFromAccumulation: 1 }, {}), null);
  assert.equal(recommendationFor({ ...fund, feeFromDeposit: null, feeFromAccumulation: null }, {}), null);
});
test('missing or above average results never become performance recommendations', () => {
  const row = { own: 12, group: { average: 10, byCompany: ['a', 'b'] } };
  assert.equal(hasUnderperformance([]), false);
  assert.equal(hasUnderperformance([{ own: null, group: row.group }]), false);
  assert.equal(hasUnderperformance([row]), false);
  assert.equal(hasUnderperformance([{ ...row, own: 9 }]), true);
  assert.equal(hasUnderperformance([{ ...row, own: 10 }]), false);
  assert.equal(comparableRows([row, { label: 'missing' }]).length, 1);
});
test('age and retirement target tracks are reviews independently of returns', () => {
  assert.ok(isAgeTrack({ investmentTrack: '2060 יעד לפרישה' }));
  assert.ok(isAgeTrack({ investmentTrack: 'לבני 50 ומטה' }));
  assert.equal(isAgeTrack({ investmentTrack: 'מניות' }), false);
  assert.equal(classifyTrack('2060 יעד לפרישה'), classifyTrack('יעד לפרישה 2060'));
  assert.notEqual(classifyTrack('יעד לפרישה 2055'), classifyTrack('יעד לפרישה 2060'));
});
