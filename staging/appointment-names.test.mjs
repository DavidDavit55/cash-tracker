import test from 'node:test';
import assert from 'node:assert/strict';
import {appointmentName,appointmentNames,summaryMeetingName} from '../.local-preview/appointment-names.js';
import {meetingDateFor} from '../.local-preview/meeting-context.js';
import {scheduleService} from '../.local-preview/workflow-service.js';
test('renames old stored appointments without changing their identity or date',()=>{
 const a={id:'a',title:'פגישת המלצות',type:'פגישת המלצות',when:'2026-10-01T13:00'};
 const c=appointmentNames({clients:[{appointments:[a]}]}).clients[0];assert.equal(c.appointments[0].title,'בדיקת תיק פנסיוני');assert.equal(c.appointments[0].id,'a');assert.equal(c.appointments[0].when,a.when);assert.equal(meetingDateFor(c),'2026-10-01');assert.equal(meetingDateFor({appointments:[a]}),'2026-10-01');assert.equal(appointmentName('המשך טיפול'),'המשך טיפול');assert.equal(appointmentName('נושא אישי'),'נושא אישי');
 assert.equal(summaryMeetingName({...c,meetingDate:'2026-10-01'}),'בדיקת תיק פנסיוני');
});
test('annual service name and one appointment from first recruitment stay stable',()=>{
 const c=scheduleService({appointments:[]},'2026-09-29T13:00');const a=c.appointments[0];assert.equal(a.title,'פגישת שירות שנתית');assert.equal(a.type,a.title);assert.ok(a.when.startsWith('2027-09-29'));assert.equal(scheduleService(c,'2026-10-01'),c);
});
