import test from 'node:test';
import assert from 'node:assert/strict';
import {planMail,applyOpeningPlan} from './mail-automation-rules.mjs';
import {reportBody} from './mail-automation-report.mjs';
const d={id:'d',sent:true,action:'ניוד קרן פנסיה בהתאם להמלצה',productCategory:'פנסיה',target:'הפניקס',pensionFlow:{version:1,signedDate:'2026-01-01'}};
const state={clients:[{id:'c',identity:'211792643',products:[],decisions:[d]}]};
const m={id:'m',client_id:'c',metadata:{direction:'incoming',at:'2026-01-05',subject:'אישור 211792643',rfcMessageId:'<unique>'}};
const extracted={text:'211792643',senderDomain:'fnx.co.il',authenticatedDomains:['fnx.co.il'],documents:[{index:0,text:'הפניקס אישור פתיחת קופה 211792643 מספר חשבון: 87654321'}]};
test('verified unique opening advances only with attached evidence, preserves original',()=>{
 const p=planMail(state,m,extracted);assert.equal(p.status,'advance');
 const next=applyOpeningPlan(state,p,{id:'pdf'});assert.equal(next.clients[0].decisions[0].pensionFlow.openingVerified,true);
 assert.equal(state.clients[0].decisions[0].pensionFlow.openingVerified,undefined);
 assert.equal(next.clients[0].decisions[0].completed,undefined);
});
test('ambiguity, bad sender, missing auth, wrong client, request and old mail never advance',()=>{
 const multi=structuredClone(state);multi.clients[0].decisions.push({...d,id:'other'});
 assert.equal(planMail(multi,m,extracted).status,'exception');
 for(const e of [{...extracted,senderDomain:'evil.test'},{...extracted,authenticatedDomains:[]},{...extracted,documents:[{index:0,text:'בקשת הצטרפות 211792643 מספר חשבון: 87654321'}]},{error:'scan failed'}])assert.notEqual(planMail(state,m,e).status,'advance');
 assert.equal(planMail(state,{...m,client_id:'wrong'},extracted).status,'exception');
 assert.notEqual(planMail(state,{...m,metadata:{...m.metadata,at:'2025-01-01'}},extracted).status,'advance');
});
test('outgoing ignored and report contains no instruction to send to client',()=>{
 assert.equal(planMail(state,{...m,metadata:{...m.metadata,direction:'outgoing'}},extracted).status,'ignored');
 assert.match(reportBody([{status:'exception',reason:'חסר',mailId:'m'}]),/לא נשלחו/);
});
test('real annex replaces demo only, never overwrites existing real evidence or completes task',()=>{
 const s=structuredClone(state);s.clients[0].decisions[0].pensionFlow.openingVerified=true;s.clients[0].decisions[0].transfer={annex:{name:'demo',simulated:true}};
 const e={...extracted,documents:[{index:0,text:'הפניקס הודעה על בחירת עובד בקרן פנסיה ת.ז 211792643'}]};
 const p=planMail(s,m,e);assert.equal(p.status,'attach');const n=applyOpeningPlan(s,p,{id:'real'}).clients[0].decisions[0];assert.equal(n.transfer.annex.id,'real');assert.equal(n.transfer.previousAnnex.name,'demo');assert.equal(n.completed,undefined);
 s.clients[0].decisions[0].transfer.annex={id:'existing'};assert.notEqual(planMail(s,m,e).status,'attach');
});
test('payroll acknowledgement is not update confirmation; quoted instructions do not count',()=>{
 const s=structuredClone(state);s.clients[0].decisions[0].transfer={inactive:false,payrollSent:true,payrollSentAt:'2026-01-01',payrollEmail:'salary@employer.test'};
 const e={...extracted,senderAddress:'salary@employer.test',senderDomain:'employer.test',authenticatedDomains:['employer.test'],body:'התקבל\nFrom: agent\nההפקדות עודכנו מחודש שכר 01/2026'};
 assert.notEqual(planMail(s,m,e).status,'payroll');
 e.body='ההפקדות עודכנו מחודש שכר 01/2026';const p=planMail(s,m,e);assert.equal(p.status,'payroll');const n=applyOpeningPlan(s,p).clients[0].decisions[0];assert.equal(n.transfer.payrollReply.status,'confirmed');assert.equal(n.transfer.depositActual,undefined);
});
