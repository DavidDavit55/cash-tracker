import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./src/pages/BudgetWorkspace.jsx',import.meta.url),'utf8');

test('cash and transaction category selectors use the complete account list',()=>{
  const cash=source.slice(source.indexOf('{cash&&'),source.indexOf("{tab==='import'"));
  const transaction=source.slice(source.indexOf('aria-label={`קטגוריה עבור'));
  for(const section of [cash,transaction]){
    assert.match(section,/allCategories\.map\(c=><option/);
    assert.doesNotMatch(section,/\{categories\.map\(c=><option/);
  }
});

test('movement editor receives all categories, including categories unused this month',()=>{
  assert.match(source,/<BudgetMovementEditor[^>]*categories=\{allCategories\}/);
  assert.doesNotMatch(source,/categories=\{categories\}/);
});

test('monthly report and filter retain the activity-based category list',()=>{
  assert.match(source,/const categories=allCategories\.filter\(c=>expenses\.some/);
  assert.match(source,/const categoryRows=\[\.\.\.categories,/);
  assert.match(source,/categories\.map\(c=>\(\{value:c\.id,label:c\.name\}\)\)/);
});
