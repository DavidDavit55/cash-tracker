import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedRequest, trustedBrowserRequest } from './policy.mjs';
import { portfolio, recommendationFor, makeDemo } from '../src/sandbox/model.js';

test('production writes and notification routes cannot cross the local gateway', () => {
  for (const path of ['/admin/clients/abc/financial-data', '/admin/raw-uploads', '/client-profile', '/expenses', '/incomes', '/budgets', '/categories', '/auth/register', '/phone-verify/send', '/whatsapp/send', '/import/discount-auto']) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(allowedRequest(method, path), false, `${method} ${path}`);
  }
  assert.equal(allowedRequest('POST', '/auth/login/send'), true);
  assert.equal(allowedRequest('POST', '/auth/login/check'), true);
});
test('only explicit read paths are allowed, including encoded path rejection', () => {
  for (const path of ['/client-profile/financial-data', '/admin/clients/abc-123/financial-data', '/admin/raw-uploads/123/file', '/expenses', '/budgets']) assert.equal(allowedRequest('GET', path), true);
  for (const path of ['/whatsapp/status', '//external.test', '/admin/clients/../../whatsapp/send', '/admin/clients/%2e%2e/financial-data', '/admin/raw-uploads/123/file/extra']) assert.equal(allowedRequest('GET', path), false);
});
test('cross-site browser calls are rejected', () => {
  assert.equal(trustedBrowserRequest({ origin: 'https://evil.example' }), false);
  assert.equal(trustedBrowserRequest({ 'sec-fetch-site': 'cross-site' }), false);
  assert.equal(trustedBrowserRequest({ origin: 'http://localhost:5173' }), false);
  assert.equal(trustedBrowserRequest({ origin: 'http://127.0.0.1:5175' }), true);
});
test('empty live data does not get demo fallback', () => {
  const p = portfolio({ source: 'live', pension_data: [], insurance_data: [], har_bituach_data: [] });
  assert.equal(p.total, 0); assert.equal(p.funds.length, 0); assert.equal(p.policies.length, 0); assert.equal(p.recommendations.length, 0);
});
test('manager savings are counted once and excluded from insurance premium', () => {
  const manager = { id: 'm1', type: 'managers', balance: '1000', monthlyPremium: 300 };
  const p = portfolio({ pension_data: [{ id: 'p1', type: 'pension', balance: '500' }], insurance_data: [manager], har_bituach_data: [manager, { id: 'life', type: 'life', monthlyPremium: '50' }, { id: 'unknown', type: 'health', monthlyPremium: null }] });
  assert.equal(p.total, 1500); assert.equal(p.premium, 50); assert.equal(p.policies.length, 2); assert.equal(p.unknownPremiums, 1);
});
test('missing birth or deposits never produce a fabricated retirement saving', () => {
  const demo = makeDemo(); const fund = demo.pension_data[0];
  assert.equal(recommendationFor(fund, { profile: {}, client_info: {} }).saving, null);
  assert.equal(recommendationFor({ ...fund, monthlyDeposit: null }, demo).saving, null);
  assert.ok(recommendationFor(fund, demo).saving > 0);
});
test('child savings are not offered agency discounts', () => {
  assert.equal(recommendationFor({ type: 'gemel', productType: 'חיסכון לכל ילד', feeFromAccumulation: 1, provider: 'הראל' }, makeDemo()), null);
});

test('unverified real monthly deposits do not drive projected savings', () => {
  const demo = makeDemo();
  const fund = demo.pension_data[0];
  for (const source of ['file', 'live']) {
    assert.equal(recommendationFor(fund, { ...demo, source }).saving, null);
    assert.ok(recommendationFor({ ...fund, monthlyDepositVerified: true }, { ...demo, source }).saving > 0);
  }
});
