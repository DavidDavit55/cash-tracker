from pathlib import Path
import shutil,datetime
root=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
backup=root/'backups'/('assistant-context-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
def edit(rel,fn):
 p=root/rel;s=p.read_text(encoding='utf-8');b=backup/rel;b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,b);p.write_text(fn(s),encoding='utf-8')
shutil.copy2(Path(__file__).parent/'contextual_assistant.py',root/'backend/app/services/contextual_assistant.py')
edit('backend/app/services/operations_bot.py',lambda s:s.replace('def respond(db,body,event_id):','def respond(db,body,event_id,client_id=None,process_id=None):').replace('    all_clients=clients(db)','    all_clients=clients(db)\n    from app.services.contextual_assistant import resolve\n    context=resolve(db,body,event_id,all_clients,client_id,process_id)\n    if context is not None:\n        if "command" not in context:return context\n        body=context["command"]'))
edit('backend/app/api/routes/simple_operations.py',lambda s:s.replace('class BotMessage(BaseModel):','class BotMessage(BaseModel):\n    clientId:str|None=None\n    processId:str|None=None').replace('return respond(db,b.body,b.eventId)','return respond(db,b.body,b.eventId,b.clientId,b.processId)'))
edit('frontend/src/pages/OperationsDesk.tsx',lambda s:s.replace("api.post('/operations/bot-preview',botPending.current)","api.post('/operations/bot-preview',{...botPending.current,clientId:embeddedClient||clientId||null,processId:selected||null})"))
