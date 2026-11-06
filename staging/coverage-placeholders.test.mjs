import assert from 'node:assert/strict';
import test from 'node:test';
import {visibleCoverages} from '../frontend/src/lib/crmDisplay.js';
test('three real coverages plus placeholders display and count as three without mutating saved data',()=>{
 const rows=[{name:'השתלות'},{name:'תרופות'},{name:'ניתוחים בחו״ל'},{name:'-'},{name:' — '},{name:''},null];
 assert.equal(visibleCoverages(rows).length,3);assert.equal(rows.length,7);
 assert.equal(visibleCoverages([{name:'כיסוי - נוסף'},{name:'-',amount:1500000},{premium:20}]).length,3);
 assert.deepEqual(visibleCoverages(undefined),[]);
});
