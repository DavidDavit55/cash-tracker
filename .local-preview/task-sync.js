// Explicitly opted-in administrative records only. Product/process checks never qualify.
export function externalTaskCompletionAllowed(task) {
 return task?.kind==='משימה אחרת'&&task.completionPolicy==='manual_internal'&&!task.decisionId&&!task.requiresEvidence&&!task.protected&&!task.financial;
}
export function taskVersion(task){return JSON.stringify([task.id,task.kind,task.note||'',task.due||'',task.productId||'',task.completionPolicy||'',task.status||'open']);}
export function applyTaskCompletions(state,updates=[]) {
 if(!state)return state;
 return {...state,clients:(state.clients||[]).map(client=>{
  const matches=updates.filter(u=>u.clientId===client.id);if(!matches.length)return client;
  const applied=[];
  const tasks=(client.operationalTasks||[]).map(task=>{const u=matches.find(x=>x.taskId===task.id);if(!u||task.status==='done'||!externalTaskCompletionAllowed(task)||taskVersion(task)!==u.previousVersion)return task;applied.push(u);return {...task,status:'done',completedAt:u.completedAt,completedVia:'google_tasks',googleTaskId:u.remoteId};});
  if(!applied.length)return client;
  return {...client,operationalTasks:tasks,events:[...(client.events||[]),...applied.map(u=>({id:u.auditId,at:u.completedAt,text:'משימה פנימית הושלמה ב-Google Tasks: '+(tasks.find(t=>t.id===u.taskId)?.note||'משימה אחרת')}))]};
 })};
}
