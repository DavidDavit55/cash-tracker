import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDeposits } from '../src/sandbox/depositHistory.js';
const row = (amount, wageMonth = '202603', date = '20260420', extra = {}) => ({ amount, wageMonth, date, ...extra });
test('aggregates components by wage month, not the order of last-deposit summaries', () => {
  const result = summarizeDeposits([row('60.10'), row('60.10'), row('65.20'), row('20', '202602', '20260420')]);
  assert.deepEqual(result.deposits.map(x => x.amount), [20, 185.4]);
  assert.equal(result.receivedDeposits[0].amount, 205.4);
  assert.equal(result.lastDepositDate, '20/04/2026');
});
test('transfers are excluded even with a wage month and do not change last deposit date', () => {
  const result = summarizeDeposits([row('100'), row('20000', '202604', '20260501', { transferringFund: 'fund' })]);
  assert.equal(result.deposits[0].amount, 100);
  assert.equal(result.transferTotal, 20000);
  assert.equal(result.lastDepositDate, '20/04/2026');
});
test('unknown amounts and dates are not fabricated, negative adjustments remain', () => {
  const result = summarizeDeposits([row('100'), row('-25'), row('50', null), row('oops'), row('30', '202602', '20260231')]);
  assert.equal(result.otherTotal, 50);
  assert.equal(result.invalidRows, 1);
  assert.equal(result.receivedDeposits[0].amount, 75);
  assert.equal(result.deposits[0].amount, 30);
  assert.equal(result.deposits[1].amount, 75);
});
