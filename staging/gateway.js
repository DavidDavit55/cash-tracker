import {createHash,timingSafeEqual,scryptSync} from 'node:crypto';
import jwt from '../backend/node_modules/jsonwebtoken/index.js';
export function sameSecret(a,b){return timingSafeEqual(createHash('sha256').update(String(a||'')).digest(),createHash('sha256').update(String(b||'')).digest());}
export function validGatePassword(value,env){
 if(!env.STAGING_PASSWORD_HASH)return sameSecret(value,env.STAGING_ACCESS_KEY);
 const [version,salt,hash]=env.STAGING_PASSWORD_HASH.split(':');
 if(version!=='scrypt'||!/^[a-f0-9]{32}$/.test(salt||'')||!/^[a-f0-9]{128}$/.test(hash||''))return false;
 if(typeof value!=='string'||!value||value.length>256)return false;
 return timingSafeEqual(scryptSync(value,salt,64),Buffer.from(hash,'hex'));
}
export function assertIsolated(env){
 if(env.APP_ENV!=='staging'||env.RAILWAY_ENVIRONMENT_NAME!=='staging')throw Error('Staging environment required');
 if(!env.STAGING_ACCESS_KEY||env.STAGING_ACCESS_KEY.length<32||!env.JWT_SECRET||env.JWT_SECRET.length<32)throw Error('Independent staging secrets required');
 if(!env.DATABASE_URL||!new URL(env.DATABASE_URL).hostname.endsWith('.railway.internal'))throw Error('Private staging database required');
 for(const key of Object.keys(env))if(/^(TWILIO_|GOOGLE_|GMAIL_|SMTP_|ANTHROPIC_API_KEY|OPENAI_API_KEY)/.test(key)&&env[key])throw Error('External integration credentials forbidden in staging: '+key);
}
export function stagingGateway(req,res,next){
 res.set('Cache-Control','no-store');res.set('X-Robots-Tag','noindex, nofollow');res.set('Referrer-Policy','same-origin');res.set('X-Content-Type-Options','nosniff');
 const cookie=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('nw_stage='))?.slice(9);
 try{const v=jwt.verify(cookie,process.env.STAGING_ACCESS_KEY,{audience:'staging-gate'});if(v.access==='owner')return next();}catch{}
 if(req.path.startsWith('/api/'))return res.status(401).json({error:'Staging access required'});
 res.status(401).type('html').send('<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NETWORTH · Staging</title><body style="font:20px Arial;background:#f3f6f2;padding:8%;color:#173e30"><h1>NETWORTH · סביבת בדיקה פרטית</h1><p>נתונים נפרדים. אין שליחת מיילים או הודעות.</p><form method="post" action="/__staging/unlock"><label>מפתח כניסה <input name="key" type="password" required autocomplete="current-password"></label><button>כניסה</button></form></body></html>');
}
export function unlock(req,res){
 if(!validGatePassword(req.body?.key,process.env))return res.status(403).send('מפתח שגוי');
 const token=jwt.sign({access:'owner'},process.env.STAGING_ACCESS_KEY,{audience:'staging-gate',expiresIn:'12h'});
 res.cookie('nw_stage',token,{httpOnly:true,secure:true,sameSite:'strict',maxAge:12*3600000,path:'/'});res.redirect('/__staging');
}
