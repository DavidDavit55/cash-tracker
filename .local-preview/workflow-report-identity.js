export const sameReport=(a,b)=>!!a.fingerprint&&a.fingerprint===b.fingerprint&&a.source===b.source&&a.asOf===b.asOf;
export function newReports(existing,incoming){
 const accepted=[];
 for(const report of incoming)if(![...existing,...accepted].some(r=>sameReport(r,report)))accepted.push(report);
 return accepted;
}
// Group only consecutive identical legacy import messages; retain original records.
export function historyGroups(events){
 const groups=[];
 for(const entry of events){
  const last=groups.at(-1);
  if(last&&entry.text===last.text&&/^נקלט דוח מקומי/.test(entry.text))last.entries.push(entry);
  else groups.push({...entry,entries:[entry]});
 }
 return groups;
}
