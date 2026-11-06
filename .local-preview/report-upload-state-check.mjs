import assert from 'node:assert/strict';
import {initialUploadState,uploadReducer as reduce,canConfirmUpload} from './report-upload-state.js';
const maslaka={id:'m',source:'maslaka',asOf:'2026-05-31',cards:[{id:'one'}],excludedPolicies:[{policy:'review'}]};
const har={id:'h',source:'har_bituach',asOf:'2026-03-01',cards:[{id:'two'}]};
for(const pair of [[maslaka,har],[har,maslaka]]){
 let state=initialUploadState;
 assert.equal(canConfirmUpload(state),false);
 for(const report of pair){
  const count=state.reports.length;
  state=reduce(state,{type:'start',source:report.source});
  assert.equal(state.reports.length,count);
  assert.equal(canConfirmUpload(state),false);
  state=reduce(state,{type:'success',report});
 }
 assert.equal(state.reports.length,2);
 assert.equal(canConfirmUpload(state),true);
 state=reduce(state,{type:'date',id:'h',value:''});
 assert.equal(state.reports.find(r=>r.id==='m').asOf,'2026-05-31');
 assert.equal(canConfirmUpload(state),false);
 state=reduce(state,{type:'date',id:'h',value:'2026-02-12'});
 assert.equal(canConfirmUpload(state),true);
 assert.deepEqual(state.reports.find(r=>r.id==='m').excludedPolicies,maslaka.excludedPolicies);
 state=reduce(state,{type:'start',source:'har_bituach'});
 assert.deepEqual(state.reports,[maslaka]);
 state=reduce(state,{type:'error',source:'har_bituach',message:'wrong identity'});
 assert.equal(canConfirmUpload(state),false);
 assert.deepEqual(state.reports,[maslaka]);
 state=reduce(state,{type:'remove',source:'har_bituach'});
 assert.equal(canConfirmUpload(state),true);
 state=reduce(state,{type:'start',source:'har_bituach'});
 state=reduce(state,{type:'success',report:har});
 assert.equal(state.reports.length,2);
 state=reduce(state,{type:'remove',source:'maslaka'});
 assert.deepEqual(state.reports,[har]);
}
assert.deepEqual(initialUploadState,{reports:[],errors:{},busy:false});
console.log('PASS: both selection orders, independent dates, pending/error guards, replacement, removal, retry, preserved warnings and initial state');
