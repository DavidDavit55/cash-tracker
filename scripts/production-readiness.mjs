import fs from 'node:fs';
const record=JSON.parse(fs.readFileSync(new URL('../releases/1.0.0.json',import.meta.url),'utf8'));
const blockers=record.gates.filter(g=>g.status!=='passed').map(g=>g.id);
if(!record.productionReleaseAuthorized)blockers.push('explicit-production-approval');
if(!record.baseline.restoreDrillPassed)blockers.push('verified-restore-drill');
if(!record.candidate.artifactSha256)blockers.push('immutable-artifact-hash');
console.log(JSON.stringify({version:record.version,ready:blockers.length===0,blockers},null,2));
process.exitCode=blockers.length?1:0;
