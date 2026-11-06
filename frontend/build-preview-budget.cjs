const fs=require('node:fs');
let text=fs.readFileSync('src/pages/BudgetWorkspace.jsx','utf8');
text=text.replace('function BudgetWorkspace(', 'function PreviewBudgetWorkspace(');
text=text.replace("const [category,setCategory]=useState(null);","const [category,setCategory]=useState(null); const [expandedCategory,setExpandedCategory]=useState(undefined);");
text=text.replace("onClick={()=>openTransactions('expense',c.id||'none')}","aria-expanded={expandedCategory===(c.id||'none')} onClick={()=>setExpandedCategory(expandedCategory===(c.id||'none')?undefined:(c.id||'none'))}");
text=text.replace("{c.id&&<button className=\"bw-link\"", "{expandedCategory===(c.id||'none')&&<div className=\"preview-category-detail\">{expenses.filter(r=>r.category_id===c.id).map(r=><div key={r.id}><span>{r.merchant||r.description}</span><time>{r.expense_date?.slice(0,10)}</time><strong>{money(r.amount)}</strong><button className=\"bw-link\" onClick={()=>editMovement({...r,kind:'expense',date:r.expense_date?.slice(0,10),label:r.merchant||r.description})}>עריכה</button></div>)}</div>}{c.id&&<button className=\"bw-link\"");
text=text.replace("{tab!=='categories'&&<section", "{tab==='transactions'&&<section");
text=text.replace('categoryRows.slice(0,5)','categoryRows');
fs.writeFileSync('src/pages/PreviewBudgetWorkspace.jsx',text);
