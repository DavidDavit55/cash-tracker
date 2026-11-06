// Share contact/documents only. Never copy deposit, transfer or delivery evidence.
export function sharePayrollDraft(client,id,draft){
 const anchor=client.decisions.find(d=>d.id===id),group=client.consolidations?.find(g=>g.id===anchor?.consolidationId);
 if(!group||!group.sourceDecisionIds.includes(id))throw Error('לא נמצא איחוד תקף');
 const members=client.decisions.filter(d=>group.sourceDecisionIds.includes(d.id)&&!d.completed&&!d.stopped);
 if(members.some(d=>d.target!==anchor.target||d.targetProductId!==anchor.targetProductId))throw Error('יעדי האיחוד אינם תואמים');
 const keys=['payrollEmail','salaryMonth','annex','cubes'];
 const shared=Object.fromEntries(keys.filter(k=>draft[k]!==undefined).map(k=>[k,structuredClone(draft[k])]));
 if(members.some(d=>d.id!==id&&keys.some(k=>d.transfer?.[k]!=null&&d.transfer[k]!==''&&JSON.stringify(d.transfer[k])!==JSON.stringify(shared[k]))))throw Error('קיימים פרטי שכר או מסמכים שונים במקור אחר. יש לבדוק אותם לפני שיתוף; דבר לא נדרס.');
 const at=new Date().toISOString();
 return {...client,consolidations:client.consolidations.map(g=>g.id===group.id?{...g,payrollDraft:{...shared,sameEmployerConfirmedAt:at,sourceDecisionId:id}}:g),decisions:client.decisions.map(d=>members.includes(d)&&!d.transfer?.payrollSent?{...d,transfer:{...d.transfer,...shared}}:d)};
}
