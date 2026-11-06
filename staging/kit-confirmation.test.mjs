import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recordExternalKit,signedKit} from '../.local-preview/workflow-process.js';
import {recordInformationSubmission,informationAppointmentTask} from '../.local-preview/info-appointment.js';
const base={action:'החלפת מוצר קיים — שחלוף בהתאם לסיכום',cancelAnnex:'ג'};
test('explicit kit submission records confirmation without reference, retaining independent old-insurer work',()=>{
 const d={...base,...recordExternalKit(base,{date:'2026-01-01',identityAttached:true})};
 assert.ok(signedKit(d));assert.equal(d.sms2010.confirmedBySubmit,true);assert.equal(d.sms2010.reference,undefined);
 assert.equal(d.infoAppointment,undefined);assert.ok(informationAppointmentTask(d));
 assert.throws(()=>recordExternalKit(d,{date:'2026-01-01',identityAttached:true}));
 assert.throws(()=>recordExternalKit(base,{date:'2099-01-01',identityAttached:true}));
 assert.throws(()=>recordExternalKit(base,{date:'2026-01-01'}));
 assert.throws(()=>recordExternalKit({...base,cancelAnnex:''},{date:'2026-01-01',identityAttached:true}));
 const document={data:'data:text/plain,test',name:'signed.txt'};
 const updated={...d,...recordInformationSubmission(d,{date:'2026-01-02',reference:'Sent separately to old insurer',document})};
 assert.ok(informationAppointmentTask(updated).due);assert.equal(updated.infoAppointment.accessVerified,false);
});
test('legacy reference confirmed kits still work; fabricated incomplete records do not',()=>{
 const legacy={...base,signed:true,sent:true,sms2010:{manual:true,status:'signed_and_sent',recordedAt:'2026-01-01T12:00:00Z',sentDate:'2026-01-01',reference:'previous record',cancelAnnex:'ג'}};
 assert.ok(signedKit(legacy));assert.equal(signedKit({...legacy,sms2010:{...legacy.sms2010,reference:''}}),false);
});
test('UI has no redundant signature checkbox/reference and hides annex after sending',()=>{
 const ui=readFileSync(new URL('../.local-preview/workflow-operation.jsx',import.meta.url),'utf8');
 assert.ok(!ui.includes('אסמכתת SMS 2010'));assert.ok(!ui.includes('וידאתי שהלקוח ואני חתמנו'));
 assert.ok(ui.includes("actionKind(d.action)==='replace'&&!d.sent&&<label"));
 const info=readFileSync(new URL('../.local-preview/info-appointment.jsx',import.meta.url),'utf8');
 assert.ok(info.includes('אין צורך להעלות שוב'));assert.ok(info.includes('היכן בדקת ומה מצאת?'));
});
