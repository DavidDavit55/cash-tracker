import test from 'node:test';
import assert from 'node:assert/strict';
import { feeProjection, retirementMonths } from '../src/sandbox/feeProjection.js';
import { recommendationFor } from '../src/sandbox/model.js';

test('retirement stops at full months before the birthday, not rounded age', () => {
  assert.equal(retirementMonths('07/02/1998', new Date(2026, 8, 18)), 460);
  assert.equal(retirementMonths('07/02/1998', new Date(2026, 8, 7)), 461);
  assert.equal(retirementMonths('31/02/1998'), null);
  assert.equal(retirementMonths('01/01/1900'), 0);
});
test('identical fees produce identical balances, including the final partial year', () => {
  const fund = { balance: 50000, monthlyDeposit: 3000, monthlyDepositVerified: true, feeFromDeposit: 1.5, feeFromAccumulation: 0.15 };
  const result = feeProjection(fund, '07/02/1998', new Date(2026, 8, 18));
  assert.equal(result.saving, 0);
  assert.equal(result.data.at(-1).year, 38.33);
  assert.ok(result.data.every(row => row.current === row.alternative));
  assert.equal(feeProjection({ ...fund, monthlyDepositVerified: false }, '07/02/1998').saving, null);
});
test('recommendations and chart use the same actual latest deposit and benchmark', () => {
  const fund = { type: 'pension', balance: 52416, feeFromDeposit: 1, feeFromAccumulation: 0.22, detailData: { deposits: [{ key: '202605', amount: 3259 }, { key: '202601', amount: 2800 }] } };
  const projection = feeProjection(fund, '07/02/1998');
  const review = recommendationFor(fund, { client_info: { birth: '07/02/1998' } });
  assert.equal(projection.monthly, 3259);
  assert.equal(review.saving, projection.saving);
  assert.equal(review.offer.feeFromDeposit, 1.5);
});
