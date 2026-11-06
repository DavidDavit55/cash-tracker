const categories=[{id:'home',name:'דיור וחשבונות'},{id:'food',name:'מזון וקניות לבית'},{id:'travel',name:'תחבורה'},{id:'health',name:'בריאות ובילויים'}];
let expenses=[['rent','home','שכר דירה',5500],['electric','home','חשמל',460],['water','home','מים',240],['food','food','קניות לבית',3100],['travel','travel','נסיעות ודלק',1240],['health','health','בריאות ובילויים',1800]].map(([id,category_id,merchant,amount])=>({id,category_id,merchant,amount,expense_date:'2026-10-07',payment_method:'נתון ניסיון'}));
let incomes=[{id:'salary',source:'משכורת',description:'משכורת לדוגמה',amount:18500,income_date:'2026-10-01',payment_method:'נתון ניסיון'}];
let budgets=categories.map((c,i)=>({category_id:c.id,amount:[7000,4000,1500,2500][i]}));
export const previewBudgetApi={
 async get(url){if(!url.startsWith('/budget-workspace/overview'))throw Error('לא נתמך בתצוגה');return {data:structuredClone({categories,expenses,incomes,budgets,bankMovements:[]})};},
 async post(url,data){if(url==='/budget-workspace/cash'){const row={id:crypto.randomUUID(),amount:Number(data.amount),payment_method:'מזומן'};if(data.kind==='income')incomes.push({...row,description:data.label,source:data.source||'אחר',income_date:data.date});else expenses.push({...row,merchant:data.label,category_id:data.category_id||null,expense_date:data.date});}else if(url==='/budgets'){budgets=budgets.filter(b=>b.category_id!==data.category_id);budgets.push({...data,amount:Number(data.amount)});}else throw Error('פעולה זו אינה מחוברת בתצוגה המקומית');return {data:{}};},
 async patch(url,data){const list=url.startsWith('/expenses/')?expenses:url.startsWith('/incomes/')?incomes:null;const row=list?.find(r=>r.id===url.split('/').pop());if(!row)throw Error('פעולה זו אינה מחוברת בתצוגה');Object.assign(row,data);return {data:row};}
};
