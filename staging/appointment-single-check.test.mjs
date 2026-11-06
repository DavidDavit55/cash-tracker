import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordAppointmentCheck,agentAppointmentReady} from '../.local-preview/agent-change-rules.js';
import {followupTaskDone,taskList} from '../.local-preview/workflow-process.js';
test('one appointment check supplies verification and retains history without manual delivery',()=>{
 const d={action:'מינוי סוכן ללא שינוי בתנאים',sent:true,sentAt:'2026-01-01T12:00:00Z'};
 const pending={...d,...recordAppointmentCheck(d,{date:'2026-01-02',result:'pending'})};assert.equal(agentAppointmentReady(pending),false);
 const accepted={...pending,...recordAppointmentCheck(pending,{date:'2026-01-03',result:'accepted'})};
 assert.ok(agentAppointmentReady(accepted));assert.ok(followupTaskDone(accepted,'verify'));assert.equal(accepted.agentAppointment.checks.length,2);
 assert.deepEqual(taskList(accepted).map(x=>x.key),['verify','call']);
 assert.ok(!taskList({action:'החלפת מוצר קיים — שחלוף בהתאם לסיכום'}).some(x=>x.key==='deliver'));
});
