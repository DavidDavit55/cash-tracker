// Mechanical replacements for the approved removal of duplicate form fields.
const fs=require('node:fs');
const file='.local-preview/workflow-agent-changes.jsx';let s=fs.readFileSync(file,'utf8');
s=s.replace('<label className="wf-field">תאריך קליטת המינוי בחברה (כאשר נקלט)<TypedDate name="acceptedAt" type="date" max={today}/></label><label className="wf-field">תיעוד בדיקת האתר<TypedDate name="reference" required/></label>','<label className="wf-field">הערה על חריגה (רשות)<TypedDate name="reference"/></label>');
s=s.replace('תאריך קליטה בחברה:','תאריך אימות המינוי:');fs.writeFileSync(file,s);
const processFile='.local-preview/workflow-process.js';s=fs.readFileSync(processFile,'utf8');
s=s.replace("{key:'deliver',title:actionKind(d.action)==='transfer'?'שליחת מסמך הניוד ללקוח':'מסירת מסמכי הביצוע ללקוח'},","...(actionKind(d.action)==='transfer'?[{key:'deliver',title:'שליחת מסמך הניוד ללקוח'}]:[]),");
s=s.replace("export function followupTaskDone(d,key){return ","export function followupTaskDone(d,key){if(key==='verify'&&['agent','change'].includes(actionKind(d.action)))return productionCheckCurrent(d);return ");fs.writeFileSync(processFile,s);
const follow='.local-preview/workflow-followup.jsx';s=fs.readFileSync(follow,'utf8');s=s.replaceAll('d.tasks[t.key].when','d.tasks?.[t.key]?.when').replaceAll('d.tasks[t.key].reference','d.tasks?.[t.key]?.reference').replaceAll('d.tasks[t.key].at',"(d.tasks?.[t.key]?.at||d.agentAppointment?.verifiedAt)");fs.writeFileSync(follow,s);
