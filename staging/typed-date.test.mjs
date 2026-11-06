import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseTypedDate,displayDate} from '../.local-preview/typed-date.js';
test('typed and pasted dates normalize without timezone shifts',()=>{
 for(const input of ['30/09/1961','30.9.1961','30-09-1961','1961-09-30',' 30/09/1961 '])assert.equal(parseTypedDate(input),'1961-09-30');
 for(const input of ['31/02/2026','29/02/2025','1/13/2020','123',''])assert.equal(parseTypedDate(input),'');
 assert.equal(parseTypedDate('29/02/2024'),'2024-02-29');assert.equal(displayDate('1961-09-30'),'30/09/1961');
});
