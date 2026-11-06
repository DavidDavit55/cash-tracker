import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../.release/budget-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import pool from './src/db/pool.js';
import router from './src/routes/reportSnapshots.js';
import { validateReport } from './src/services/reportSnapshots.js';
import { onlyDate, reportDate, reportProducts } from '../frontend/src/lib/reportMetadata.js';

const clientId = '00000000-0000-4000-8000-000000000001';
const adminId = '00000000-0000-4000-8000-000000000002';
const otherId = '00000000-0000-4000-8000-000000000003';
const report = { source: 'maslaka', subjectId: '123456782', asOfDate: '2026-05-31', issuedOn: '2026-06-22', pensionData: [{ id: '001', name: 'Test', provider: 'Test', balance: 12 }], insuranceData: [] };

test('dates and identity are explicit and validated; mixed dates never guessed', () => {
  assert.equal(reportDate('20260622140555'), '2026-06-22');
  assert.equal(onlyDate(['20260531', '20260531']), '2026-05-31');
  assert.equal(onlyDate(['20260531', '20260131']), '');
  assert.equal(reportDate('31/02/2026'), '');
  assert.equal(reportDate('12/02/2026'), '2026-02-12');
  assert.throws(() => validateReport({ ...report, asOfDate: '2026-02-30' }, report.subjectId));
  assert.throws(() => validateReport(report, '999999999'));
  assert.throws(() => validateReport({ ...report, issuedOn: '2025-01-01' }, report.subjectId));
  assert.throws(() => validateReport({ ...report, pensionData: [] }, report.subjectId));
  assert.throws(() => validateReport({ ...report, pensionData: [{ id: '001', name: {}, provider: 'Test' }] }, report.subjectId));
  assert.deepEqual(validateReport(report, '0000000123456782'), { pensionData: report.pensionData, insuranceData: [] });
  assert.equal(reportProducts({ payload: validateReport(report, report.subjectId) }).length, 1);
});

test('isolated PostgreSQL: immutable dated reports, original bytes, duplicate rejection, admin access, no live writes', async () => {
  // In-memory PostgreSQL only. Never connect to DATABASE_URL.
  const db = new PGlite();
  const originalQuery = pool.query;
  process.env.JWT_SECRET = 'report-unit-test-only'; process.env.ADMIN_EMAIL = 'admin@example.test';
  await db.exec('CREATE TABLE users (id UUID PRIMARY KEY); CREATE TABLE client_profiles (user_id UUID, id_number TEXT); CREATE TABLE client_financial_data (user_id UUID, review JSONB);');
  const schema = (await readFile(new URL('./src/db/report-snapshots.sql', import.meta.url), 'utf8')).replaceAll('uuid_generate_v4()', 'gen_random_uuid()');
  await db.exec(schema); await db.exec(schema);
  for (const id of [clientId, adminId, otherId]) await db.query('INSERT INTO users VALUES ($1)', [id]);
  await db.query('INSERT INTO client_profiles VALUES ($1,$2)', [clientId, report.subjectId]);
  await db.query('INSERT INTO client_financial_data VALUES ($1,$2)', [clientId, JSON.stringify({ text: 'preserved' })]);
  pool.query = (sql, params) => db.query(sql, params);
  const app = express(); app.use('/reports', router);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/reports`;
  const auth = { Authorization: `Bearer ${jwt.sign({ id: adminId, email: process.env.ADMIN_EMAIL }, process.env.JWT_SECRET)}` };
  const post = (value, bytes = 'original bytes') => {
    const body = new FormData(); body.append('report', JSON.stringify(value)); body.append('file', new Blob([bytes]), 'source.xml');
    return fetch(`${base}/${clientId}/reports`, { method: 'POST', headers: auth, body });
  };
  try {
    assert.equal((await fetch(`${base}/${clientId}/reports`)).status, 401);
    const nonAdmin = jwt.sign({ id: clientId, email: 'client@example.test' }, process.env.JWT_SECRET);
    assert.equal((await fetch(`${base}/${clientId}/reports`, { headers: { Authorization: `Bearer ${nonAdmin}` } })).status, 403);
    assert.equal((await post({ ...report, subjectId: '999999999' })).status, 400);
    const first = await post(report); assert.equal(first.status, 201); const saved = await first.json();
    assert.equal((await post(report)).status, 409);
    assert.equal((await post({ ...report, asOfDate: '2026-01-31' }, 'older report')).status, 201);
    const listing = await fetch(`${base}/${clientId}/reports`, { headers: auth });
    assert.equal(listing.headers.get('cache-control'), 'no-store');
    const records = await listing.json(); assert.equal(records.length, 2); assert.equal(records[0].as_of_date, '2026-05-31');
    assert.ok(!('file_data' in records[0])); assert.ok(records[0].received_at);
    const original = await fetch(`${base}/${clientId}/reports/${saved.id}/file`, { headers: auth });
    assert.equal(await original.text(), 'original bytes');
    assert.equal((await fetch(`${base}/${otherId}/reports/${saved.id}/file`, { headers: auth })).status, 404);
    assert.deepEqual((await db.query('SELECT review FROM client_financial_data')).rows[0].review, { text: 'preserved' });
  } finally { pool.query = originalQuery; await new Promise(resolve => server.close(resolve)); await db.close(); }
});
