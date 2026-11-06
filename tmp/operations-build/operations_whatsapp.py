"""Optional inbound-only Twilio adapter. Disabled until explicitly configured and verified."""
import os,hmac,hashlib,base64,re
from urllib.parse import parse_qs
from xml.sax.saxutils import escape
from fastapi import APIRouter,Depends,Request,HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db
from app.api.routes.office import record,save
from app.services.simple_process import command,transition,reply

router=APIRouter()
PATH='/api/operations/whatsapp/inbound'

def enabled():return os.getenv('OPERATIONS_WHATSAPP_ENABLED')=='1'

def signature(url,params,token):
    value=url+''.join(k+v for k in sorted(params) for v in sorted(set(params[k])))
    return base64.b64encode(hmac.new(token.encode(),value.encode(),hashlib.sha1).digest()).decode()

def validate(params,sig):
    required=['TWILIO_AUTH_TOKEN','TWILIO_ACCOUNT_SID','TWILIO_WHATSAPP_NUMBER','OPERATIONS_OWNER_WHATSAPP','OPERATIONS_WEBHOOK_URL']
    if not enabled() or not all(os.getenv(k) for k in required):raise HTTPException(503,'Bot is not enabled')
    if not hmac.compare_digest(signature(os.environ['OPERATIONS_WEBHOOK_URL'],params,os.environ['TWILIO_AUTH_TOKEN']),sig or ''):raise HTTPException(403,'Invalid signature')
    one=lambda key:params.get(key,[''])[0]
    if one('From')!='whatsapp:'+os.environ['OPERATIONS_OWNER_WHATSAPP'] or one('To')!='whatsapp:'+os.environ['TWILIO_WHATSAPP_NUMBER'] or one('AccountSid')!=os.environ['TWILIO_ACCOUNT_SID']:raise HTTPException(403,'Sender not allowed')

@router.post(PATH)
async def incoming(request:Request,db:Session=Depends(get_db)):
    if not enabled():raise HTTPException(503,'Bot is not enabled')
    if not request.headers.get('content-type','').startswith('application/x-www-form-urlencoded'):raise HTTPException(415)
    raw=await request.body()
    if len(raw)>16000:raise HTTPException(413)
    params=parse_qs(raw.decode(),keep_blank_values=True);validate(params,request.headers.get('x-twilio-signature',''))
    body=params.get('Body',[''])[0];sid=params.get('MessageSid',[''])[0]
    if not re.fullmatch(r'SM[0-9a-fA-F]{32}',sid):raise HTTPException(400,'Invalid message identifier')
    from app.services.operations_bot import respond
    try:result=respond(db,body,sid)['reply']
    except HTTPException as exc:result=str(exc.detail)+' — לא בוצע עדכון.'
    return Response('<Response><Message>'+escape(result)+'</Message></Response>',media_type='application/xml')
