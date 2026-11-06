import test from 'node:test';
import assert from 'node:assert/strict';
import { accountProvider } from '../src/sandbox/accountProvider.js';
import { findBrand } from '../src/sandbox/providerBrands.js';
test('each account uses its enclosing manufacturer in a multi-company document', () => {
  const root = { localName: 'Root', parentElement: null };
  const account = company => ({ parentElement: { localName: 'Mutzar', parentElement: { localName: 'YeshutYatzran', parentElement: root, children: [{ localName: 'SHEM-YATZRAN', textContent: company }] } } });
  for (const [company, logo] of [['הראל פנסיה וגמל', 'harel.svg'], ['מנורה מבטחים פנסיה וגמל', 'menora.png']]) {
    const provider = accountProvider(account(company));
    assert.equal(provider, company);
    assert.equal(findBrand(provider).file, logo);
  }
  assert.equal(accountProvider({ parentElement: root }), null);
});

import { portfolio } from '../src/sandbox/model.js';
import { dedupById, productKey } from '../src/sandbox/productIdentity.js';
test('same account number at three pension companies remains three funds', () => {
  const funds = ['מיטב', 'מנורה', 'אלטשולר שחם'].map((provider, i) => ({ id: '123456789', provider, type: 'pension', balance: 100 * (i + 1) }));
  const result = portfolio({ pension_data: [...funds, funds[0]] });
  assert.equal(result.funds.length, 3);
  assert.equal(result.total, 600);
  assert.equal(new Set(result.funds.map(productKey)).size, 3);
  assert.equal(dedupById([funds[0], { ...funds[0], provider: 'מיטב גמל ופנסיה בע״מ' }]).length, 1);
});
