"""Authenticated dashboard/simulator API. No outbound messages, calendar writes or data migration."""
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.api.deps import get_current_user
from app.db.session import get_db
from app.api.routes.office import record,save
from app.services.simple_process import transition,digest,command,reply

router=APIRouter(prefix='/api/operations',dependencies=[Depends(get_current_user)])

class Change(BaseModel):
    clientId:str
    revision:int=Field(ge=1)
    processId:str|None=None
    eventId:str=Field(min_length=1,max_length=100)
    action:str
    values:dict={}

@router.get('')
def overview(db:Session=Depends(get_db)):
    clients=[record(db,r[0]) for r in db.execute(text('SELECT id FROM office_clients'))]
    clients=[c for c in clients if not c.get('archivedTo')]
    return {**digest(clients),'clients':[{'id':c['id'],'name':c['name'],'revision':c['revision'],'products':c.get('products',[]),'processes':c.get('simpleProcesses',[])} for c in clients]}

@router.post('/actions')
def mutate(b:Change,db:Session=Depends(get_db)):
    c=record(db,b.clientId)
    # Duplicate request is acknowledged even when its old revision has moved.
    changed,p=transition(c,b.processId,b.action,b.values,b.eventId)
    if changed:c=save(db,c,b.revision,'תהליך פשוט: '+b.action)
    return {'client':c,'process':p,'reply':reply(p),'duplicate':not changed}

class Message(Change):
    body:str=Field(min_length=1,max_length=3000)

@router.post('/simulate')
def simulate(b:Message,db:Session=Depends(get_db)):
    action=command(b.body)
    if not action:return {'clarification':True,'reply':'לא שיניתי דבר. בחר פעולה בטיפול או כתוב: נשלח, עדיין ממתין, הופק. פענוח הודעות חופשיות והודעות מועברות עדיין אינו מחובר.'}
    if action=='result':
        c=record(db,b.clientId);p=next((p for p in c.get('simpleProcesses',[]) if p['id']==b.processId),None)
        if not p or p['kind']!='production':raise HTTPException(400,'הופק מתאים להפקה בלבד; בתביעה ושינוי יש לאמת תוצאה')
    return mutate(Change(**{**b.model_dump(exclude={'body'}),'action':action}),db)

@router.get('/connections')
def connections():
    import os
    required=['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_WHATSAPP_NUMBER','OPERATIONS_OWNER_WHATSAPP','OPERATIONS_WEBHOOK_URL']
    return {'whatsapp':{'enabled':os.getenv('OPERATIONS_WHATSAPP_ENABLED')=='1','configured':{k:bool(os.getenv(k)) for k in required}},'summary':{'time':'19:00','timezone':'Asia/Jerusalem','scheduled':False},'google':{'expectedAccount':'david@davit-fin.co.il','simpleProcessSync':False},'email':{'connectedToProcesses':False}}

class BotMessage(BaseModel):
    body:str=Field(min_length=1,max_length=3000)
    eventId:str=Field(min_length=1,max_length=100)

@router.post('/bot-preview')
def bot_preview(b:BotMessage,db:Session=Depends(get_db)):
    from app.services.operations_bot import respond
    return respond(db,b.body,b.eventId)
