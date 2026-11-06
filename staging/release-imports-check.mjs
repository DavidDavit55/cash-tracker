import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('.staging-release'),seen=new Set();
function visit(file){
 if(seen.has(file)||file.includes('node_modules'))return;seen.add(file);
 assert.ok(fs.existsSync(file),'Missing packaged runtime dependency: '+path.relative(root,file));
 const source=fs.readFileSync(file,'utf8');
 for(const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])(\.\.?\/[^'"]+)\1/g)){
  if(/^\s*\+/.test(source.slice(m.index+m[0].length)))continue; // Dynamic route prefix, copied separately below.
  let target=path.resolve(path.dirname(file),m[2]);if(!path.extname(target))target+='.js';visit(target);
 }
}
visit(path.join(root,'staging/server.mjs'));
for(const file of fs.readdirSync(path.join(root,'backend/src/routes')))if(file.endsWith('.js'))visit(path.join(root,'backend/src/routes',file));
const copies=[...fs.readFileSync(path.join(root,'staging/Dockerfile'),'utf8').matchAll(/^COPY\s+(\S+)/gm)].map(m=>m[1].replace(/^\.\//,''));
for(const file of seen){if(file.includes('node_modules'))continue;const relative=path.relative(root,file).replaceAll('\\','/');assert.ok(copies.some(p=>relative===p||relative.startsWith(p+'/')),'Runtime file missing from Docker COPY: '+relative);}
console.log('PASS: packaged static runtime imports resolve and Docker includes them ('+seen.size+' source files).');
