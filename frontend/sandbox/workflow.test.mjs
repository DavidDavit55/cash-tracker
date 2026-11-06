import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { workflow } from './workflow.mjs';

test('isolated registration, signed consents, notifications, role checks and idempotent upload', async () => {
  const calls = [];
  const env = Object.fromEntries(['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID', 'TWILIO_CONTENT_SID_WELCOME', 'TWILIO_CONTENT_SID_LEAD_ALERT', 'TWILIO_CONTENT_SID_RECOMMENDATIONS'].map(k => [k, k]));
  Object.assign(env, { TWILIO_WHATSAPP_NUMBER: '0500000000', ADMIN_WHATSAPP_NUMBER: '0500000001' });
  const handler = workflow({ directory: mkdtempSync(join(tmpdir(), 'nw-test-')), env, transport: async (url, options) => {
    calls.push({ url, body: String(options.body || '') });
    return { ok: true, json: async () => url.includes('VerificationCheck') ? { status: 'approved' } : { sid: 'SMtest', status: 'queued' } };
  } });
  const server = createServer((req, res) => { req.headers.host = '127.0.0.1:5175'; handler(req, res, () => { res.statusCode = 404; res.end(); }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  async function request(path, body, token, origin = 'http://127.0.0.1:5175') {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/sandbox-workflow${path}`, { method: body ? 'POST' : 'GET', headers: { Host: '127.0.0.1:5175', Origin: origin, Authorization: `Bearer ${token || ''}` }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json() };
  }
  try {
    assert.equal((await request('/admin/clients')).status, 401);
    assert.equal((await request('/admin/login', { password: 'long-test-password' }, null, 'https://evil.test')).status, 403);
    assert.equal((await request('/local-login', { phone: '0500000002', code: '123456', role: 'admin' })).status, 400);
    const admin = (await request('/local-login', { phone: '0500000001', code: '123456', role: 'admin' })).data.token;
    assert.ok(admin);
    assert.equal((await request('/otp/send', { phone: '0500000002' })).status, 410);
    assert.equal((await request('/otp/check', { phone: '0500000002', code: '123456' })).status, 410);
    assert.equal(calls.length, 0);
    assert.equal((await request('/admin/login', { password: 'long-test-password' })).status, 401);
    const clientToken = (await request('/local-login', { phone: '0500000002', code: '123456' })).data.token;
    assert.equal((await request('/admin/clients', null, clientToken)).status, 401);
    const registration = { name: 'Test Client', id_number: '000000018', birth_date: '1990-01-01', consents: { maslaka: true, insurance_poa: true, har_bituach: true }, whatsappConsent: true, signature: 'data:image/png;base64,' + 'A'.repeat(400) };
    assert.equal((await request('/register', { ...registration, consents: {} }, clientToken)).status, 400);
    const created = await request('/register', registration, clientToken);
    assert.equal(created.status, 201);
    const id = created.data.client.id;
    await request('/register', registration, clientToken);
    assert.equal(calls.filter(c => c.url.endsWith('Messages.json')).length, 2);
    const snapshot = { client_info: { id: '000000018' }, pension_data: [{ id: 'p1', balance: 100 }], insurance_data: [], har_bituach_data: [] };
    assert.equal((await request(`/admin/clients/${id}/data`, { snapshot, notify: true }, clientToken)).status, 401);
    assert.equal((await request(`/admin/clients/${id}/data`, { snapshot: { ...snapshot, client_info: { id: '000000026' } } }, admin)).status, 400);
    assert.equal((await request(`/admin/clients/${id}/data`, { snapshot, notify: true }, admin)).status, 200);
    await request(`/admin/clients/${id}/data`, { snapshot, notify: true }, admin);
    assert.equal(calls.filter(c => c.url.endsWith('Messages.json')).length, 3);
    assert.equal((await request('/me', null, clientToken)).data.client.financial.pension_data[0].balance, 100);
    assert.equal((await request('/admin/clients', null, admin)).data.clients.length, 1);
    const version = (await request('/me', null, clientToken)).data.client.updatedAt;
    const draft = { text: 'Review after inspecting the file', agentName: 'Test Agent', version };
    assert.equal((await request(`/admin/clients/${id}/review`, draft, clientToken)).status, 401);
    assert.equal((await request(`/admin/clients/${id}/review`, { ...draft, version: 'stale', publish: true }, admin)).status, 409);
    assert.equal((await request(`/admin/clients/${id}/review`, draft, admin)).status, 200);
    const beforePublication = (await request('/me', null, clientToken)).data.client;
    assert.equal(beforePublication.review, undefined);
    assert.equal(beforePublication.reviewDraft, undefined);
    assert.equal((await request(`/admin/clients/${id}/review`, { ...draft, publish: true }, admin)).status, 200);
    assert.equal((await request('/me', null, clientToken)).data.client.review.text, draft.text);
    await request(`/admin/clients/${id}/review`, { ...draft, text: 'Unpublished changes' }, admin);
    assert.equal((await request('/me', null, clientToken)).data.client.review.text, draft.text);
    assert.equal(calls.filter(c => c.url.endsWith('Messages.json')).length, 3);
    await request(`/admin/clients/${id}/data`, { snapshot: { ...snapshot, pension_data: [{ id: 'p1', balance: 200 }] }, notify: false }, admin);
    assert.equal((await request('/me', null, clientToken)).data.client.review, undefined);
    const optionalToken = (await request('/local-login', { phone: '0500000003' })).data.token;
    const callCount = calls.length;
    const optional = await request('/register', { ...registration, id_number: '000000026', whatsappConsent: false }, optionalToken);
    assert.equal(optional.status, 201);
    assert.equal(optional.data.client.whatsappConsent, false);
    assert.equal(calls.length, callCount + 1, 'only admin notification, no WhatsApp to client without consent');
    assert.ok(calls.every(c => !c.url.includes('railway') && !c.url.includes('verify.twilio.com')));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
