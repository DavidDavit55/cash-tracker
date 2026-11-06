import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const mode=process.argv[2],candidate=path.resolve('.release/production-budget-20261011-upload/frontend');
const sha=b=>createHash('sha256').update(b).digest('hex');
if(mode==='before'||mode==='after'){
 const dest=path.resolve('.release/production-budget-20261011-'+(mode==='before'?'before':'live'));fs.mkdirSync(dest);
 const response=await fetch('https://networth.davit-fin.co.il/summary');if(!response.ok)throw Error('Live page unavailable');
 const html=await response.text();fs.writeFileSync(path.join(dest,'index.html'),html);
 const assets=[...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(m=>m[1]))];
 const manifest=[];for(const asset of assets){const r=await fetch('https://networth.davit-fin.co.il'+asset);if(!r.ok)throw Error('Missing live asset');const bytes=Buffer.from(await r.arrayBuffer());fs.mkdirSync(path.join(dest,'assets'),{recursive:true});fs.writeFileSync(path.join(dest,asset),bytes);manifest.push({asset,sha256:sha(bytes)});}
 fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({saved:manifest.length,assets}));
}else if(mode==='compare'){
 const baseline=path.resolve('.release/production-category-options-20261007-upload/frontend'),changes=[];
 function walk(dir,rel=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','dist'].includes(e.name))continue;const p=path.join(rel,e.name);if(e.isDirectory())walk(path.join(dir,e.name),p);else{const old=path.join(baseline,p);if(!fs.existsSync(old)||sha(fs.readFileSync(old))!==sha(fs.readFileSync(path.join(candidate,p))))changes.push(p.replaceAll('\\','/'));}}}walk(candidate);
 const expected=['src/components/AdminLayout.jsx','src/components/BudgetRelease.css','src/components/BudgetWorkspace.css','src/pages/BudgetWorkspace.jsx'];
 if(JSON.stringify(changes.sort())!==JSON.stringify(expected.sort()))throw Error('Unexpected release source changes: '+changes.join(','));console.log(JSON.stringify({changes}));
}else if(mode==='verify'){
 const html=await (await fetch('https://networth.davit-fin.co.il/summary')).text(),local=fs.readFileSync(path.join(candidate,'dist/index.html'),'utf8');
 const assets=[...new Set([...local.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(m=>m[1]))];
 for(const asset of assets){if(!html.includes(asset))throw Error('Candidate not served');const r=await fetch('https://networth.davit-fin.co.il'+asset);if(!r.ok||sha(Buffer.from(await r.arrayBuffer()))!==sha(fs.readFileSync(path.join(candidate,'dist',asset))))throw Error('Live artifact mismatch');}
 console.log(JSON.stringify({liveVerified:true,assets,backendDeployed:false,databaseWrites:0}));
}else throw Error('Use before, compare or verify');
