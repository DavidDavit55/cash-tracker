import {reportDate} from '../frontend/src/lib/reportMetadata.js';

export const initialUploadState = {reports:[],errors:{},busy:false};
export function uploadReducer(state,action){
 switch(action.type){
  case 'start': return {...state,busy:true,reports:state.reports.filter(r=>r.source!==action.source),errors:{...state.errors,[action.source]:''}};
  case 'success': return {...state,busy:false,reports:[...state.reports.filter(r=>r.source!==action.report.source),action.report]};
  case 'error': return {...state,busy:false,errors:{...state.errors,[action.source]:action.message}};
  case 'remove': return {...state,reports:state.reports.filter(r=>r.source!==action.source),errors:{...state.errors,[action.source]:''}};
  case 'date': return {...state,reports:state.reports.map(r=>r.id===action.id?{...r,asOf:action.value}:r)};
  default: return state;
 }
}
export const canConfirmUpload = state => !state.busy && state.reports.length>0 && !Object.values(state.errors).some(Boolean) && state.reports.every(r=>Boolean(reportDate(r.asOf)));
