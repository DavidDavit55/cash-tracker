import test from 'node:test';
import assert from 'node:assert/strict';
import { survivorSalaryRate } from '../src/sandbox/survivorRate.js';
test('survivor pensions express 60/40 of insured salary, not raw coverage percentages', () => {
 assert.equal(survivorSalaryRate(8512.56, 14187.6), 60);
 assert.equal(survivorSalaryRate(5675.04, 14187.6), 40);
 assert.equal(survivorSalaryRate(0, 14187.6), 0);
 for(const salary of [null, 0, -1, NaN]) assert.equal(survivorSalaryRate(8512.56, salary), null);
 assert.equal(survivorSalaryRate(null, 14187.6), null);
});
