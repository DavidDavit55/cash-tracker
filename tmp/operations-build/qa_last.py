from pathlib import Path
r=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations')
def edit(path,old,new):
 p=r/path;s=p.read_text(encoding='utf-8');assert old in s,(path,old[:60]);p.write_text(s.replace(old,new),encoding='utf-8')
edit('frontend/src/pages/OfficePage.tsx',"const setTab=(value:string)=>setParams(p=>{const q=new URLSearchParams(p);", "const setTab=(value:string)=>setParams(()=>{const q=new URLSearchParams(window.location.search);")
edit('frontend/src/pages/OperationsDesk.tsx','{kinds[row.kind]} · {row.product}</td>','{kinds[row.kind]} · {row.product}{row.caseDescription&&<small style={{display:\'block\'}}>{row.caseDescription}</small>}</td>')
edit('backend/app/services/simple_process.py','def stamp():', '''def validate_link(target,category,product):
    if not target:return
    aliases={'ביטוח חיים':'ריסק רגיל','חיים':'ריסק רגיל','השתלמות':'קרן השתלמות','קרן פנסיה':'פנסיה','ביטוח בריאות':'בריאות'}
    for raw in [target.get('name'),target.get('category')]:
        normalized=aliases.get(raw,raw)
        family=next((cat for cat,items in PRODUCTS.items() if normalized in items),None)
        if family:
            need(category==family,'קטגוריית הטיפול חייבת להתאים למוצר המקושר')
            if normalized!='ריסק רגיל' or raw not in ['חיים','ביטוח חיים']:
                need(product==normalized,'סוג הטיפול חייב להתאים למוצר המקושר')
            return

def stamp():''')
edit('backend/app/services/simple_process.py',"            need(target,'המוצר אינו שייך ללקוח')", "            need(target,'המוצר אינו שייך ללקוח')\n            validate_link(target,category,product)")
edit('backend/app/services/simple_process.py',"            p.update(category=category,product=product,mode=mode,", "            validate_link(target,category,product)\n            p.update(category=category,product=product,mode=mode,")
p=r/'backend/tests/test_qa_regressions.py'
p.write_text(p.read_text(encoding='utf-8')+'''
def test_linked_product_category_cannot_contradict():
 c,p=seed();c['products'][0]['category']='בריאות'
 with pytest.raises(HTTPException):act(c,p,'details',category='פיננסים',product='גמל',company='הראל',mode='new')
 with pytest.raises(HTTPException):act(c,None,'create',kind='claim',category='בריאות',product='בריאות',company='הראל',productId='p',newCase=True)
''',encoding='utf-8')
print('Final consistency fixes applied')
