import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from './src/db/pool.js';
const notifications = [];
mock.module('./src/services/whatsappTwilio.js', { namedExports: { notifyClientNewRecommendations: async payload => { notifications.push(payload); return {status: "accepted", messageId: "SMtest"}; } } });
mock.module('./src/services/whatsappHistory.js', { namedExports: { getWhatsAppHistory: async phone => { assert.equal(phone, '0501234567'); return { messages: [{id: 'SMtest', status: 'read'}] }; } } });
const { default: admin } = await import('./src/routes/admin.js');
import profile from './src/routes/clientProfile.js';

test('production review permissions, draft isolation, stale version and upload invalidation', async () => {
  process.env.JWT_SECRET = 'isolated-test-key';
  process.env.ADMIN_EMAIL = 'review-admin@example.test';
  const originalQuery = pool.query;
  const version = '00000000-0000-4000-8000-000000000001';
  let record = { data_version: version, review: null, review_draft: null };
  pool.query = async (sql, values) => {
    if (sql.startsWith('UPDATE client_financial_data SET review_draft')) {
      if (values[4] !== record.data_version) return { rows: [] };
      record.review_draft = JSON.parse(values[0]);
      if (values[1]) record.review = JSON.parse(values[2]);
      return { rows: [record] };
    }
    if (sql.startsWith('SELECT u.name, u.email, cp.phone')) return { rows: [{ name: 'Recipient', email: values[0] === 'admin-id' ? process.env.ADMIN_EMAIL : 'client@example.test', phone: '0501234567' }] };
    if (sql.startsWith('SELECT phone FROM client_profiles')) { assert.equal(values[0], 'client-id'); return {rows: [{phone: '0501234567'}]}; }
    if (sql.includes('AND data_version::text=$2')) return {rows: values[1] === record.data_version ? [{pension_data:[{id:'test-pension',provider:'Test',type:'pension'}]}] : []};
    if (sql.startsWith('SELECT pension_data')) {
      assert.equal(values[0], 'client-id');
      assert.ok(!sql.includes('review_draft'));
      return { rows: [{ review: record.review }] };
    }
    if (sql.includes('INSERT INTO client_financial_data')) {
      assert.match(sql, /review = NULL, review_draft = NULL, data_version = gen_random_uuid\(\)/);
      record = { ...record, review: null, review_draft: null, data_version: 'changed' };
      return { rows: [record] };
    }
    throw new Error('Unexpected database call');
  };
  const app = express(); app.use(express.json());
  app.use('/admin', admin); app.use('/client-profile', profile);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const clientToken = jwt.sign({ id: 'client-id', email: 'client@example.test' }, process.env.JWT_SECRET);
  const adminToken = jwt.sign({ id: 'admin-id', email: process.env.ADMIN_EMAIL }, process.env.JWT_SECRET);
  const call = (path, token, body, method = 'POST') => fetch(base + path, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  const body = { text: 'Reviewed recommendation', agentName: 'Agent', version, publish: false };
  try {
    assert.equal((await call('/admin/clients/client-id/messages', null, null, 'GET')).status, 401);
    assert.equal((await call('/admin/clients/client-id/messages', clientToken, null, 'GET')).status, 403);
    const history = await call('/admin/clients/client-id/messages', adminToken, null, 'GET');
    assert.equal(history.headers.get('cache-control'), 'no-store');
    assert.equal((await history.json()).messages[0].status, 'read');
    assert.equal((await call('/admin/clients/client-id/review', null, body)).status, 401);
    assert.equal((await call('/admin/clients/client-id/review', clientToken, body)).status, 403);
    assert.equal((await call('/admin/clients/client-id/review', adminToken, { ...body, text: '' })).status, 400);
    assert.equal((await call('/admin/clients/client-id/review', adminToken, body)).status, 200);
    assert.equal((await (await call('/client-profile/financial-data', clientToken, null, 'GET')).json()).review, null);
    assert.equal(notifications.length, 0);
    const productKey = JSON.stringify(['savings','Test','pension','test-pension']);
    const structured = {...body, text:'', assessments:{[productKey]:{coverage:{status:'action',note:'Check coverage'}}}};
    const structuredDraft = await call('/admin/clients/client-id/review', adminToken, structured);
    assert.equal(structuredDraft.status,200);
    assert.equal((await structuredDraft.json()).review_draft.assessments[productKey].coverage.status,'action');
    assert.equal(record.review,null);
    assert.equal(notifications.length,0);
    assert.equal((await call('/admin/clients/client-id/review',adminToken,{...structured,assessments:{foreign:{}}})).status,400);
    assert.equal((await call('/admin/clients/client-id/review',adminToken,{...structured,publish:true,assessments:{[productKey]:{coverage:{status:'action',note:''}}}})).status,400);
    const published = await call('/admin/clients/client-id/review', adminToken, { ...body, publish: true });
    assert.equal(published.status, 200);
    assert.equal((await published.json()).notification.status, 'accepted');
    assert.deepEqual(notifications, [{phone: '0501234567', name: 'Recipient'}]);
    assert.equal((await call('/admin/clients/admin-id/review', adminToken, { ...body, publish: true })).status, 200);
    assert.equal(notifications.length, 1);
    assert.equal((await (await call('/client-profile/financial-data', clientToken, null, 'GET')).json()).review.text, body.text);
    assert.equal((await call('/admin/clients/client-id/financial-data', adminToken, { pensionData: [], notify: true }, 'PUT')).status, 200);
    assert.equal(record.review, null);
    assert.equal(notifications.length, 1);
    assert.equal((await call('/admin/clients/client-id/review', adminToken, { ...body, publish: true })).status, 409);
  } finally {
    pool.query = originalQuery;
    await new Promise(resolve => server.close(resolve));
  }
});
