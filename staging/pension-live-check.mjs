// Read-only authenticated bundle verification. Never writes CRM or contacts Google.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base='https://networth-staging-staging.up.railway.app';
const config=JSON.parse(fs.readFileSync(new URL('../.staging-private/credentials.json',import.meta.url),'utf8'));
const unlock=await fetch(base+'/__staging/unlock',{method:'POST',redirect:'manual',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({key:config.STAGING_ACCESS_KEY})});
assert.equal(unlock.status,302);
const headers={Cookie:unlock.headers.get('set-cookie').split(';')[0]};
async function get(path){const r=await fetch(base+path,{headers,redirect:'manual',signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);return r.text();}
const html=await get('/admin/crm'),main=html.match(/src="([^"]+\/index-[^"]+\.js)"/)[1];
const js=await get(main),chunk=js.match(/(StagingCrm-[\w-]+\.js)/)[1];
const crm=await get('/assets/'+chunk);
if(process.argv[2])assert.equal(chunk,process.argv[2],'Expected deployed CRM bundle');
for(const text of ['שמירת בדיקת ההפקה','תאריך קליטה בפועל','המעבר למעקב הניוד חסום','להשלים פרטים ולעקוב אחרי בקשות מידע'])assert.ok(crm.includes(text),text);
assert.ok(crm.includes('employee:6,employer:6.5,severance:6'));
for(const text of ['מעקב ואישור ביטול הפוליסה הישנה','תזכורת לבדיקה בלבד','האישור השמור ישמש לבדיקה'])assert.ok(crm.includes(text),text);
assert.equal(crm.includes('תיעוד שליחת בקשת הביטול'),false);
console.log(JSON.stringify({result:'PASS',chunk,unifiedCancellation:true,cancellationReminderOnly:true,interactivePensionVerification:true,depositDefaults:true,depositGapBlock:true,crmWrites:0,emailsSent:0}));
