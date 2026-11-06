// Isolated, loopback-only connection check. Never loads the application DB or mail jobs.
// Credentials stay in the user-selected file; tokens are retained in memory only.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const ORIGIN = 'http://127.0.0.1:43821';
export const REDIRECT = `${ORIGIN}/oauth/google/callback`;
export const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const EXPECTED_EMAIL = 'david@davit-fin.co.il';
export function authorizationUrl(clientId, state, verifier) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({client_id:clientId,redirect_uri:REDIRECT,
    response_type:'code',scope:SCOPE,state,access_type:'online',
    login_hint:EXPECTED_EMAIL,prompt:'select_account consent',
    code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
  return url.toString();
}
export function createConnectionServer(credentials, request = fetch) {
  if (!credentials?.client_id || !credentials?.client_secret || credentials.project_id !== 'networth-crm') throw new Error('Invalid credential configuration');
  const gate=randomBytes(32).toString('hex');
  let pending=null, connected=false;
  const page=(res,status,title,text,extra='')=>{
    res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
      // Preserve Origin on same-origin POSTs without leaking the local URL to Google.
      'Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://accounts.google.com; frame-ancestors 'none'"});
    res.end(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NETWORTH · חיבור Gmail</title><body style="font:18px Arial;background:#f7f8f4;color:#214c3f;padding:40px;max-width:700px;margin:auto"><h1>${title}</h1><p style="line-height:1.8">${text}</p>${extra}</body></html>`);
  };
  const server=http.createServer(async(req,res)=>{
    if(req.headers.host!=='127.0.0.1:43821')return page(res,403,'בקשה חסומה','יש להשתמש בכתובת המקומית שסופקה.');
    const url=new URL(req.url,ORIGIN);
    try {
      if(req.method==='GET'&&url.pathname==='/'){
        if(url.searchParams.get('key')!==gate)return page(res,403,'קישור חסר','יש לפתוח את קישור ההגדרה המקומי.');
        return page(res,200,'חיבור Gmail · בדיקה מקומית',connected?'בדיקת החיבור הצליחה. עדיין אין סנכרון מיילים ב־CRM.':'החשבון המיועד: david@davit-fin.co.il. תתבקש לאשר הרשאת קריאה בלבד. הבדיקה תוודא את כתובת התיבה בלבד — לא תקרא הודעות ולא תשלח דבר. ההרשאה לא תישמר בקובץ.',`<form method="post" action="/connect?key=${gate}"><button style="padding:14px;font:inherit">המשך לאישור בגוגל</button></form>`);
      }
      if(req.method==='POST'&&url.pathname==='/connect'){
        if(url.searchParams.get('key')!==gate||req.headers.origin!==ORIGIN)return page(res,403,'בקשה חסומה','פתח את מסך החיבור המקומי.');
        pending={state:randomBytes(32).toString('hex'),verifier:randomBytes(48).toString('base64url'),session:randomBytes(32).toString('hex'),until:Date.now()+600000};
        res.writeHead(303,{'Location':authorizationUrl(credentials.client_id,pending.state,pending.verifier),'Cache-Control':'no-store','Set-Cookie':`nw_gmail=${pending.session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`});return res.end();
      }
      if(req.method==='GET'&&url.pathname==='/oauth/google/callback'){
        const session=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('nw_gmail='))?.slice(9);
        if(!pending||pending.until<Date.now()||url.searchParams.get('state')!==pending.state||session!==pending.session)return page(res,400,'האישור לא תקף','חזור למסך החיבור והתחל מחדש.');
        const attempt=pending;pending=null;
        if(url.searchParams.has('error'))return page(res,400,'לא אושרה גישה','לא נקראו הודעות. אפשר לנסות מחדש ממסך החיבור.');
        const code=url.searchParams.get('code');if(!code)return page(res,400,'חסר אישור','התחל מחדש ממסך החיבור.');
        const exchange=await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:credentials.client_id,client_secret:credentials.client_secret,code,code_verifier:attempt.verifier,redirect_uri:REDIRECT,grant_type:'authorization_code'}),signal:AbortSignal.timeout(15000)});
        if(!exchange.ok)throw new Error('exchange');
        const tokens=await exchange.json();
        if(!tokens.access_token||!tokens.scope?.split(' ').includes(SCOPE))throw new Error('scope');
        const profile=await request('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{Authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(15000)});
        if(!profile.ok)throw new Error('profile');
        const mailbox=await profile.json();
        // Do not persist tokens, mailbox counts, history IDs, or message contents.
        if(mailbox.emailAddress?.toLowerCase()!==EXPECTED_EMAIL)return page(res,403,'נבחר חשבון אחר','הבדיקה מיועדת למייל העסקי בלבד. חזור ובחר בחשבון העסקי.');
        connected=true;
        res.writeHead(303,{'Location':`${ORIGIN}/?key=${gate}`,'Cache-Control':'no-store','Set-Cookie':'nw_gmail=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});return res.end();
      }
      return page(res,404,'העמוד לא נמצא','אין פעולה זמינה בכתובת הזו.');
    }catch{return page(res,502,'החיבור לא הושלם','לא נקראו הודעות. בדוק שהסוד החדש פעיל וכתובת החזרה נשמרה בגוגל. אין לשתף סודות או קודי אישור.');}
  });
  return {server,startUrl:`${ORIGIN}/?key=${gate}`};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const config=JSON.parse(await readFile(process.argv[2],'utf8')).web;
    const {server,startUrl}=createConnectionServer(config);
    server.on('error',()=>{console.error('Local connection server could not start.');process.exitCode=1;});
    server.listen(43821,'127.0.0.1',()=>console.log(`Local setup: ${startUrl}\nRedirect URI: ${REDIRECT}`));
  }catch{console.error('Credential file could not be loaded. No credential values logged.');process.exitCode=1;}
}
