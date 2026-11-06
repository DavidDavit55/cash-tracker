import fs from 'node:fs';
const dir=new URL('../.staging-private/',import.meta.url);
const {STAGING_ACCESS_KEY}=JSON.parse(fs.readFileSync(new URL('credentials.json',dir),'utf8'));
fs.writeFileSync(new URL('ACCESS.txt',dir),`NETWORTH — סביבת בדיקה פרטית\n\nhttps://networth-staging-staging.up.railway.app\n\nמפתח כניסה (להעתיק לשדה באתר):\n${STAGING_ACCESS_KEY}\n\nאחרי הכניסה בחר אדמין. אפשר לעבור לחשבון לקוח לדוגמה בסרגל העליון.\nנתוני בדיקה בלבד. אין שליחות ואין חיבור לנתוני האתר החי.\n`,{mode:0o600});
console.log('Private owner access instructions saved (key not printed).');
