// Pure read projection: service requests never downgrade a produced product.
export function simpleProductStatus(client,product,day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jerusalem'})){
 const flows=(client.simpleProcesses||[]).filter(p=>p.productId===product.id&&p.kind==='production'&&p.state!=='stopped');
 const flow=flows.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0];
 if(!flow)return null;
 if(flow.verified&&['followup','handled','done'].includes(flow.state)){
  const effective=flow.agreed?.effective||product.effective;
  if(effective&&effective>day)return {label:'הופק — תחילה עתידית',tone:'pending',detail:'ההפקה אומתה. תאריך תחילה: '+effective};
  return {label:'הופק — ההפקה אומתה',tone:'verified',detail:flow.state==='done'?'ההפקה נבדקה מול הסיכום, הלקוח עודכן והטיפול הושלם.':flow.state==='followup'?'ההפקה אומתה; נותר מעקב ביטול או ניוד.':'ההפקה אומתה; נותר עדכון הלקוח.'};
 }
 if(flow.state==='produced')return {label:'הופק — ממתין לבדיקת הפקה',tone:'pending',detail:'התקבלה הפקה; יש לבדוק התאמה לסיכום עם הלקוח.'};
 if(product.commissionPolicy?.status==='active')return null;
 return {label:{new:'חדש — טרם נשלח לחברה',sent:'נשלח לחברה — ממתין להפקה',reject:'ריג׳קט — נדרשת השלמה'}[flow.state]||'בהפקה',tone:'pending',detail:flow.state==='reject'?flow.detail||'נדרשת השלמה מול החברה.':'מצב טיפול ההפקה המקושר למוצר.'};
}
