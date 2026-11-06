import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertIsolated,sameSecret,validGatePassword} from './gateway.js';
import {scryptSync} from 'node:crypto';
const valid={APP_ENV:'staging',RAILWAY_ENVIRONMENT_NAME:'staging',STAGING_ACCESS_KEY:'k'.repeat(40),JWT_SECRET:'j'.repeat(40),DATABASE_URL:'postgresql://user:pass@postgres.railway.internal:5432/railway'};
test('only isolated environment accepted',()=>{assert.doesNotThrow(()=>assertIsolated(valid));for(const patch of [{APP_ENV:'production'},{RAILWAY_ENVIRONMENT_NAME:'production'},{DATABASE_URL:'postgresql://user:pass@production.example/db'},{SMTP_PASS:'secret'},{TWILIO_AUTH_TOKEN:'secret'},{JWT_SECRET:'short'}])assert.throws(()=>assertIsolated({...valid,...patch}));});
test('secret comparison rejects empty or wrong keys',()=>{assert.equal(sameSecret('correct','correct'),true);assert.equal(sameSecret('wrong','correct'),false);assert.equal(sameSecret(undefined,'correct'),false);});
test('separate password preserves signing secret and rejects old key and malformed hashes',()=>{
 const salt='a'.repeat(32),env={...valid,STAGING_PASSWORD_HASH:'scrypt:'+salt+':'+scryptSync('test-password',salt,64).toString('hex')};
 assert.equal(validGatePassword('test-password',env),true);
 for(const value of ['wrong',valid.STAGING_ACCESS_KEY,'',undefined,'x'.repeat(257)])assert.equal(validGatePassword(value,env),false);
 assert.equal(validGatePassword('test-password',{...env,STAGING_PASSWORD_HASH:'invalid'}),false);
 assert.equal(validGatePassword(valid.STAGING_ACCESS_KEY,valid),true);
 assert.doesNotThrow(()=>assertIsolated(env));
});
