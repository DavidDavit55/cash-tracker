import test from 'node:test';
import assert from 'node:assert/strict';
import { ltmFromHistory } from '../src/sandbox/marketComparison.js';
test('reported cumulative returns work without five years of monthly history', () => {
  const rows = [{ REPORT_PERIOD: 202607, YIELD_TRAILING_3_YRS: 54.27, YIELD_TRAILING_5_YRS: 69.09 }];
  assert.equal(ltmFromHistory(rows, 202607, 36), 54.27);
  assert.equal(ltmFromHistory(rows, 202607, 60), 69.09);
  assert.equal(ltmFromHistory(rows, 202607, 12), null);
  assert.equal(ltmFromHistory(rows, 202606, 36), null);
});
test('missing returns are not zero and zero returns are valid', () => {
  assert.equal(ltmFromHistory([{ REPORT_PERIOD: 202607, YIELD_TRAILING_5_YRS: null }], 202607, 60), null);
  assert.equal(ltmFromHistory([{ REPORT_PERIOD: 202607, YIELD_TRAILING_5_YRS: 0 }], 202607, 60), 0);
});
