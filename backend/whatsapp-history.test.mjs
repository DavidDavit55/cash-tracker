import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
let requested;
mock.module('twilio', { defaultExport: () => ({ messages: { list: async filters => {
  requested = filters;
  return [{sid: 'SM1', from: filters.from, to: filters.to, body: 'hello', status: 'read', dateCreated: '2026-09-19', dateSent: '2026-09-19', numMedia: '0'},
    {sid: 'other', from: filters.from, to: 'whatsapp:+972500000000', body: 'private'}];
} } }) });
const { getWhatsAppHistory } = await import('./src/services/whatsappHistory.js');
test('history filters both endpoints, excludes other customers, and preserves read status', async () => {
  process.env.TWILIO_ACCOUNT_SID = 'test'; process.env.TWILIO_AUTH_TOKEN = 'test'; process.env.TWILIO_WHATSAPP_NUMBER = '0530000000';
  const result = await getWhatsAppHistory('0541111111');
  assert.deepEqual(requested, {from: 'whatsapp:+972530000000', to: 'whatsapp:+972541111111', limit: 51});
  assert.equal(result.messages.length, 1); assert.equal(result.messages[0].status, 'read');
  assert.equal(result.messages[0].body, 'hello'); assert.equal(result.messages[0].readAt, undefined);
  assert.equal((await getWhatsAppHistory(null)).unavailable, 'missing_phone');
  delete process.env.TWILIO_AUTH_TOKEN;
  assert.equal((await getWhatsAppHistory('0541111111')).unavailable, 'missing_configuration');
});
