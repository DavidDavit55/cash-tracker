
import {depositDifference,changeRequests} from './workflow-detail-rules.js';
import React from 'react';
import {businessDate} from './workflow-process.js';
import {actionKind} from './workflow-process.js';
import {transferNext} from './workflow-transfer-stages.js';
import {agentAppointmentReady} from './agent-change-rules.js';
export function pendingTasks(d){
 if(d.stopped||d.completed)return [];
 const u=d.underwriting||{},tasks=[];
 if(depositDifference(d).open)tasks.push({title:'בירור פער בהפקדה: '+Math.abs(depositDifference(d).gap)+' ₪',due:'להיום'});
 if(agentAppointmentReady(d))for(const t of changeRequests(d))if(!d.changeTasks?.[t.key]?.done)tasks.push({title:t.title,due:t.due||'פתוח'});
 if(d.produced)return tasks;
 if(d.missing)tasks.push({title:'השלמת חוסרים מהחברה',due:'להיום'});
 if(d.underwritingPending){
  if(u.alternative)tasks.push({title:'תיעוד חלופה ואישור הלקוח',due:'פתוח'});
  else if(!u.recipient)tasks.push({title:'השלמת כתובת תפעול לחיתום',due:'להיום'});
  if(u.signatureAt&&!u.file)tasks.push({title:'תזכורת חתימה על תנאי חיתום',due:businessDate(u.signatureAt,2)});
  if(u.sentAt)tasks.push({title:'בירור תשובה לתנאי החיתום',due:businessDate(u.sentAt,2)});
 }else if(d.signatureSent&&!d.signed)tasks.push({title:'תזכורת חתימה',due:businessDate((d.signatureSentAt||d.sentAt||new Date().toISOString()),2)});
 else if(d.sent&&actionKind(d.action)==='transfer'&&!d.fundsConfirmed){const next=transferNext(d);tasks.push({title:next.title,due:next.due||'פתוח'});}
 else if(d.sent&&!d.approved)tasks.push({title:'בדיקת תשובת החברה',due:businessDate((d.sentAt||new Date().toISOString()),5)});
 return tasks;
}
export default function OpenTasks({decisions,onOpen}){return decisions.flatMap(d=>pendingTasks(d).map((t,i)=><div className="wf-list-row" key={d.id+i}><div><b>{t.title}</b><p>{d.target} · {t.due}</p></div><button className="secondary" onClick={onOpen}>לטיפול</button></div>));}
