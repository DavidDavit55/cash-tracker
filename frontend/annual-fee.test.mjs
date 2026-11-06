import test from 'node:test';import assert from 'node:assert/strict';import {annualFeeComparison,longTermFeeComparison} from './src/lib/annualFeeComparison.js';
const base={balance:100000,monthly:1000,currentDeposit:1,currentBalance:.5,offerDeposit:1,offerBalance:.5};
test('equal fees produce zero; absent input blocks calculation',()=>{assert.equal(annualFeeComparison(base).saving,0);assert.equal(annualFeeComparison({...base,monthly:''}),null);});
test('both fee components matter and worse offer remains negative',()=>{const r=annualFeeComparison({...base,offerDeposit:6,offerBalance:.5});assert.ok(r.saving<0);assert.equal(r.current.depositFees,120);assert.equal(r.offer.depositFees,720);});
test('zero fees conserve opening balance plus twelve deposits',()=>{const r=annualFeeComparison({...base,offerDeposit:0,offerBalance:0});assert.equal(r.offer.closing,112000);assert.equal(r.offer.total,0);assert.ok(Math.abs(r.current.closing+r.current.total-112000)<1e-8);});

test('long-term equal assumptions, zero return conservation and horizon guards',()=>{assert.equal(longTermFeeComparison({...base,months:120}).difference,0);assert.equal(longTermFeeComparison({...base,months:12,annualReturn:0,offerDeposit:0,offerBalance:0}).offer,112000);assert.equal(longTermFeeComparison({...base,months:null}),null);assert.ok(longTermFeeComparison({...base,months:120,offerDeposit:6}).difference<0);});
