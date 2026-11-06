import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='.release/production-budget-20261011-upload',target='.release/production-budget-export-20261012-upload',backup='.release/production-budget-export-20261012-before';
const hash=b=>createHash('sha256').update(b).digest('hex');
const mode=process.argv[2];
if(mode==='prepare'){
 assert.ok(!fs.existsSync(target));assert.ok(!fs.existsSync(backup));
 const html=await (await fetch('https://networth.davit-fin.co.il/summary')).text();
 assert.ok(html.includes('index-BhhJ2IcN.js'),'Production changed; stop');
 fs.mkdirSync(backup,{recursive:true});fs.writeFileSync(path.join(backup,'index.html'),html);
 const manifest=[];
 for(const asset of [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(m=>m[1])){
  const response=await fetch('https://networth.davit-fin.co.il'+asset);assert.ok(response.ok);
  const bytes=Buffer.from(await response.arrayBuffer());fs.mkdirSync(path.join(backup,'assets'),{recursive:true});fs.writeFileSync(path.join(backup,asset),bytes);manifest.push({asset,sha256:hash(bytes)});
 }
 fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify(manifest,null,2));
 fs.cpSync(base,target,{recursive:true,filter:source=>!source.split(path.sep).some(p=>['node_modules','dist'].includes(p))});
 for(const file of ['src/lib/budgetExport.js','src/components/BudgetExport.jsx'])fs.copyFileSync(path.join('frontend',file),path.join(target,'frontend',file));
 console.log(JSON.stringify({backup,target,assets:manifest.length}));
}else if(mode==='compare'){
 const changes=[];
 function walk(relative=''){
  for(const e of fs.readdirSync(path.join(target,relative),{withFileTypes:true})){
   if(['node_modules','dist'].includes(e.name))continue;
   const rel=path.join(relative,e.name);if(e.isDirectory())walk(rel);else if(!fs.existsSync(path.join(base,rel))||hash(fs.readFileSync(path.join(base,rel)))!==hash(fs.readFileSync(path.join(target,rel))))changes.push(rel.replaceAll('\\','/'));
  }
 }
 walk();assert.deepEqual(changes.sort(),['frontend/src/components/BudgetExport.jsx','frontend/src/components/BudgetImport.jsx','frontend/src/lib/budgetExport.js','frontend/src/pages/BudgetWorkspace.jsx'].sort());
 console.log(JSON.stringify({scope:'four frontend files only',changes,backendChanges:0}));
}else if(mode==='verify'){
 const html=await (await fetch('https://networth.davit-fin.co.il/import')).text();
 const asset=html.match(/src="(\/assets\/[^"?#]+\.js)"/)[1];
 assert.ok(!asset.includes('BhhJ2IcN'),'Old release still served');
 const js=await (await fetch('https://networth.davit-fin.co.il'+asset)).text();
 for(const phrase of ['ייצוא תנועות ל־PDF','ייבוא וייצוא נתונים','הורדת PDF'])assert.ok(js.includes(phrase),phrase);
 assert.ok(js.includes('cash-tracker-production-35dd.up.railway.app'));
 assert.ok(!js.includes('staging-admin@example.invalid'));
 const dest='.release/production-budget-export-20261012-live';fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'index.html'),html);fs.writeFileSync(path.join(dest,'bundle.js'),js);
 console.log(JSON.stringify({live:true,asset,sha256:hash(js),backendChanges:0,databaseWrites:0}));
}else throw Error('Unknown mode');
