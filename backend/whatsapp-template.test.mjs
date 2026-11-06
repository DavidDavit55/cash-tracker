import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
let status = 'pending', fail = false, sendFails = false;
const messages = [];
mock.module('twilio', { defaultExport: () => ({
  content: { v1: { contents: () => ({ approvalFetch: () => ({ fetch: async () => {
    if (fail) throw new Error('unavailable');
    return { whatsapp: { status } };
  } }) }) } },
  messages: { create: async message => { if (sendFails) throw new Error("test send rejection"); messages.push(message); return {sid: "SMtest"}; } },
}) });
const { notifyClientNewRecommendations } = await import('./src/services/whatsappTwilio.js');
test('link template activates only after approval, preserving notification on pending or failure', async () => {
  process.env.TWILIO_WHATSAPP_NUMBER = '+15005550006';
  process.env.TWILIO_CONTENT_SID_RECOMMENDATIONS = 'original';
  process.env.TWILIO_CONTENT_SID_RECOMMENDATIONS_WITH_LINK = 'with-link';
  for (const current of ['pending', 'rejected', 'approved']) {
    status = current;
    await notifyClientNewRecommendations({ phone: '+15005550009', name: 'Test' });
    assert.equal(messages.at(-1).contentSid, current === 'approved' ? 'with-link' : 'original');
    assert.deepEqual(JSON.parse(messages.at(-1).contentVariables), { 1: 'Test' });
  }
  fail = true;
  await notifyClientNewRecommendations({ phone: '+15005550009', name: 'Test' });
  assert.equal(messages.at(-1).contentSid, 'original');
  assert.equal(messages.length, 4);
});

 test('notification results distinguish acceptance, rejection and missing configuration', async () => {
  fail = false;
  assert.deepEqual(await notifyClientNewRecommendations({phone: '+15005550009', name: 'Test'}), {status: 'accepted', messageId: 'SMtest'});
  sendFails = true;
  assert.deepEqual(await notifyClientNewRecommendations({phone: '+15005550009', name: 'Test'}), {status: 'failed'});
  sendFails = false;
  assert.deepEqual(await notifyClientNewRecommendations({phone: '', name: 'Test'}), {status: 'skipped', reason: 'missing_phone'});
  delete process.env.TWILIO_WHATSAPP_NUMBER;
  assert.deepEqual(await notifyClientNewRecommendations({phone: '+15005550009', name: 'Test'}), {status: 'skipped', reason: 'missing_configuration'});
 });
