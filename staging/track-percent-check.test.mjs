import test from 'node:test';
import assert from 'node:assert/strict';
import {changeFields,recordChangeCheck,changeTaskReady} from '../.local-preview/agent-change-rules.js';
const d={action:'מינוי סוכן וביצוע השינויים שבסיכום',sent:true,sentAt:'2026-01-01',agentAppointment:{acceptedAt:'2026-01-02',verifiedAt:'2026-01-02T12:00:00Z',siteChecked:true,siteReference:'אתר החברה'},allocations:[{name:'מניות',fundId:'123',percent:50},{name:'מניות סחיר',fundId:'456',percent:25},{name:'S&P 500',fundId:'789',percent:25}]};
const data={date:'2026-01-03',result:'complete',reference:'נבדק באתר',siteChecked:true,actual:{percent0:50,percent1:25,percent2:25}};
test('track change checks percentages by named track without requiring fund numbers',()=>{
 assert.deepEqual(changeFields(d,'track').map(f=>f.key),['percent0','percent1','percent2']);
 const next={...d,...recordChangeCheck(d,'track',data)};assert.equal(changeTaskReady(next,'track'),true);assert.deepEqual(next.allocations,d.allocations);
 assert.throws(()=>recordChangeCheck(d,'track',{...data,actual:{percent0:25,percent1:50,percent2:25}}));
 assert.throws(()=>recordChangeCheck(d,'track',{...data,actual:{percent0:50,percent1:25}}));
});
test('full distribution remains required; old fund-number evidence is preserved',()=>{
 const incomplete={...d,allocations:[{name:'מניות',fundId:'123',percent:50}]};
 assert.throws(()=>recordChangeCheck(incomplete,'track',{...data,actual:{percent0:50}}));
 const legacy={...d,...recordChangeCheck(d,'track',{...data,actual:{...data.actual,fund0:'123',fund1:'456',fund2:'789'}})};
 assert.equal(changeTaskReady(legacy,'track'),true);assert.equal(legacy.changeTasks.track.actual.fund0,'123');
});
