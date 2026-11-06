import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import pool from './src/db/pool.js';

let approved = false, sent = 0;
mock.module('./src/lib/twilioVerify.js', { namedExports: {
  toE164: value => value,
  verifyService: () => ({ verifications: { create: async () => { sent++; } },
    verificationChecks: { create: async () => ({ status: approved ? 'approved' : 'pending' }) } }),
} });
const { default: auth } = await import('./src/routes/auth.js');
test('formatted phone lookup still requires OTP and rejects ambiguous accounts', async () => {
  process.env.JWT_SECRET = 'numeric-regression-test-only';
  let rows = [{ id: 'test-id', email: 'test@example.test', name: 'Test' }];
  let queries = 0;
  const original = pool.query;
  pool.query = async (sql, params) => {
    queries++;
    assert.match(sql, /regexp_replace\(regexp_replace\(phone,/);
    assert.match(sql, /regexp_replace\(regexp_replace\(\$1,/);
    assert.equal(params[0], '0501234567');
    return { rows };
  };
  const app = express(); app.use(express.json()); app.use(auth);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const call = path => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0501234567', code: '001234' }),
  });
  try {
    assert.equal((await call('/login/check')).status, 400);
    assert.equal(queries, 0, 'unapproved OTP must not reach account lookup');
    assert.equal((await call('/login/send')).status, 200);
    assert.equal(sent, 1);
    approved = true;
    assert.ok((await (await call('/login/check')).json()).token);
    rows = [rows[0], { ...rows[0], id: 'another-id' }];
    assert.equal((await call('/login/check')).status, 404);
    assert.equal((await call('/login/send')).status, 404);
    assert.equal(sent, 1, 'ambiguous accounts must not send OTP');
  } finally { pool.query = original; await new Promise(resolve => server.close(resolve)); }
});
