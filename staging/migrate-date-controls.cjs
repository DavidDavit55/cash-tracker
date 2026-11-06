// Mechanical JSX tag replacement, limited to CRM workflow components.
const fs=require('node:fs');
for(const name of ['appointment-edit','workflow-agent-changes','workflow-followup','workflow-meeting','workflow-operation','workflow-operational-tasks','workflow-upload','pension-verification','production-verification','workflow-transfer']){
 const file='.local-preview/'+name+'.jsx';let text=fs.readFileSync(file,'utf8');
 if(text.includes("import TypedDate from './typed-date.jsx'"))continue;
 text="import TypedDate from './typed-date.jsx';\n"+text.replace(/<input\b/g,'<TypedDate');fs.writeFileSync(file,text);
}
