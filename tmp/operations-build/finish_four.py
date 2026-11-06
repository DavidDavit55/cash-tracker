exec(open(__file__.replace('finish_four.py','fix_four_flows.py'),encoding='utf-8').read().split('def backend(s):')[0])
def desk(s):
 s=replace(s,"setProductId(initialProduct||productId)}", "selectProduct(initialProduct||productId)}")
 s=replace(s,"{kind==='change'&&<label>","{kind==='change'&&<label>") if False else s
 s=replace(s,"mode:p.kind==='production'?mode:'new'})", "mode:p.kind==='production'?mode:'new',serviceType})")
 s=replace(s,"<label>מועד המעקב הבא<input", "<label>מועד המעקב הבא<input") if False else s
 s=replace(s,"{p.state==='sent'&&<>","{p.state==='sent'&&<>") if False else s
 s=replace(s,"בתביעת תשלום — שהכסף התקבל", "בתביעת תשלום — שהכסף התקבל; במינוי — שהמינוי נקלט באתר החברה")
 s=replace(s,"disabled={busy||!due||!detail.trim()} onClick={()=>act('reject'", "disabled={busy||!due||!detail.trim()} onClick={()=>act('reject'") if False else s
 # Keep the outcome description visible; do not hide required inputs in collapsed details.
 s=replace(s,"{['sent','produced','followup'].includes(p.state)&&<label>","{['sent','produced','followup','reject'].includes(p.state)&&<label>")
 return s
edit('frontend/src/pages/OperationsDesk.tsx',desk)
def back(s):
 s=replace(s,"        p={'id':str(uuid.uuid4())", """        if linked:
            existing=next((p for p in processes if p.get('productId')==linked and p['kind']==kind and p['state'] not in ['done','stopped'] and (kind!='change' or p.get('serviceType','')==data.get('serviceType',''))),None)
            if existing:return False,existing
        p={'id':str(uuid.uuid4())""")
 s=replace(s,"'production':'הפקה'", "'production':'הצטרפות'")
 return s
edit('backend/app/services/simple_process.py',back)
# Supply policy in older test fixtures now that this is part of the explicit flow.
edit('backend/tests/test_simple_process.py',lambda s:replace(s,"company='חברת דמה',mode=mode)","company='חברת דמה',mode=mode,policy='TEST-123')"))
edit('backend/tests/test_assistant_dialog.py',lambda s:replace(s,"'company':'מגדל'", "'company':'מגדל','policy':'TEST-123'"))
print('Finished')
