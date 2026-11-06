import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('QR bot retired while operational Twilio notifications remain',()=>{
 const index=fs.readFileSync(new URL('./src/index.js',import.meta.url),'utf8');
 const profile=fs.readFileSync(new URL('./src/routes/clientProfile.js',import.meta.url),'utf8');
 assert.doesNotMatch(index,/initWhatsApp|whatsappRoutes/);
 assert.match(index,/sendStatus\(410\)/);
 assert.match(profile,/notifyAdminNewLead\(/);assert.match(profile,/notifyClientWelcome\(/);
 assert.equal(fs.existsSync(new URL('./src/services/whatsapp.js',import.meta.url)),false);
 const pkg=JSON.parse(fs.readFileSync(new URL('./package.json',import.meta.url)));
 assert.equal(pkg.dependencies['whatsapp-web.js'],undefined);
 assert.ok(pkg.dependencies.twilio);
});
