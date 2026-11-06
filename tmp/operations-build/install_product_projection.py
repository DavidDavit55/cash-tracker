from pathlib import Path
import shutil,datetime
root=Path(r'C:\Users\david\OneDrive\שולחן העבודה\KING-DAVID\davit-operations');backup=root/'backups'/('product-projection-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
def edit(rel,fn):
 p=root/rel;s=p.read_text(encoding='utf-8');b=backup/rel;b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,b);p.write_text(fn(s),encoding='utf-8')
shutil.copy2(Path(__file__).parent/'simple-product-status.js',root/'frontend/src/pages/simple-product-status.js')
edit('frontend/src/pages/product-status.js',lambda s:"import {simpleProductStatus} from './simple-product-status.js';\n"+s.replace(' if(health){',' const simple=simpleProductStatus(client,p);if(simple&&!p.lifecycle?.needsReview)return simple;\n if(health){'))
edit('frontend/src/pages/OfficeProducts.jsx',lambda s:s.replace("['done','stopped'].includes(q.state)?'היסטוריית טיפול':'המשך טיפול'","(['done','stopped'].includes(q.state)?'היסטוריית ':'המשך ')+({production:'הפקה',claim:'תביעה',change:'שינוי'}[q.kind]||'טיפול')"))
edit('frontend/src/pages/OfficePage.tsx',lambda s:s.replace('<OperationsDesk key={c.id} embeddedClient','<OperationsDesk key={c.id+(params.get(\'process\')||\'\')} embeddedClient'))
