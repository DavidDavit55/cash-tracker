import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { digitsOnly, phoneDigits } from '../src/lib/numericInput.js';

test('numeric fields retain zeros and clean pasted and non-ASCII digits', () => {
  assert.equal(digitsOnly('00 123-4567', 9), '001234567');
  assert.equal(digitsOnly('קוד: ٠۱۲ ٣٤۵', 6), '012345');
  assert.equal(phoneDigits('050-123 4567'), '0501234567');
  assert.equal(phoneDigits('+972 50 123 4567'), '0501234567');
  assert.equal(phoneDigits('00972 50 123 4567'), '0501234567');
  assert.equal(digitsOnly(null), '');
});

test('full questionnaire labels fit the migrated production columns', () => {
  const register = readFileSync(new URL('../src/pages/Register.jsx', import.meta.url), 'utf8');
  const schema = readFileSync(new URL('../../backend/src/db/schema.sql', import.meta.url), 'utf8');
  const labels = [...register.matchAll(/'(שמרן[^']*|מאוזן[^']*|נועז[^']*)'/g)].map(match => match[1]);
  assert.equal(labels.length, 3);
  assert.ok(labels.some(label => label.length > 50), 'exercise the actual failing questionnaire answer');
  for (const column of ['risk_tolerance','investment_horizon','financial_knowledge','goals','life_stage']) {
    assert.ok(schema.includes(`ALTER COLUMN ${column} TYPE TEXT`));
  }
});
