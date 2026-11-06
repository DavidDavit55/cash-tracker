"""Loopback-only preview. Dedicated demo SQLite; no production or external services."""
import os,sys
from pathlib import Path
root=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
sys.path.insert(0,str(root/'backend'))
database=Path(__file__).parent/'operations-demo.sqlite'
os.environ['DATABASE_URL']='sqlite:///'+database.as_posix()
os.environ['DISABLE_AUTH']='true'
os.environ['OPERATIONS_WHATSAPP_ENABLED']='0'
from fastapi import FastAPI,HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.db.session import engine,Base,SessionLocal
from app import models
from app.api.routes import office,simple_operations,auth,sales,clients,policies,dashboard
from app.services.office_integration import schema
from sqlalchemy import text
import uvicorn
Base.metadata.create_all(engine);office.initialize()
with SessionLocal() as db:
    schema(db);db.commit()
    if not db.execute(text('SELECT count(*) FROM office_clients')).scalar():
        for name in ['דמה #01 — שחלוף בריאות','דמה #02 — תביעת בריאות','דמה #03 — שינוי מסלול']:
            office.create(office.NewClient(name=name),db)
app=FastAPI();app.include_router(auth.router);app.include_router(simple_operations.router);app.include_router(office.router)
for router in [sales.router,clients.router,policies.router,dashboard.router]:app.include_router(router)
@app.middleware('http')
async def local_only(request,call_next):
    from fastapi.responses import JSONResponse
    if request.headers.get('host')!='127.0.0.1:4198':return JSONResponse({'detail':'Local preview only'},403)
    if request.method=='POST' and request.headers.get('origin')!='http://127.0.0.1:4198':return JSONResponse({'detail':'Same-origin required'},403)
    return await call_next(request)
dist=root/'frontend/dist';app.mount('/assets',StaticFiles(directory=dist/'assets'),name='assets')
@app.get('/{path:path}')
def spa(path:str):
    if path.startswith('api/'):raise HTTPException(404)
    candidate=(dist/path).resolve()
    if candidate.is_relative_to(dist.resolve()) and candidate.is_file():return FileResponse(candidate)
    return FileResponse(dist/'index.html')
if __name__=='__main__':uvicorn.run(app,host='127.0.0.1',port=4198)
