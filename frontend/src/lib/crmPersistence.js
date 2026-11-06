// Serial, revision-checked writes. A failed/ambiguous response freezes writes;
// never retry automatically and risk overwriting a newer server state.
export function createCrmPersistence({save, revision: initialRevision, onStatus=()=>{}}) {
 let revision=initialRevision, queued=null, pending=null, sending=false, failed=false;
 const status=error=>onStatus({revision,saving:sending||!!queued,failed,error,pending});
 async function flush(){
  if(sending||failed||!queued)return;
  const batch=queued;queued=null;sending=true;status();
  try{
   const result=await save({revision,state:batch.state});
   if(!Number.isInteger(result.revision)||result.revision!==revision+1)throw Error('Invalid save acknowledgement');
   revision=result.revision;sending=false;if(!queued)pending=null;status();
  }catch(error){sending=false;failed=true;status(error);return;}
  // Callback errors must not turn a confirmed database write into a save failure.
  for(const callback of batch.callbacks){try{callback();}catch(error){console.error('CRM saved callback failed',error);}}
  void flush();
 }
 return {
  persist(state,onSaved){
   if(failed)return false;
   const snapshot=structuredClone(state);
   pending=snapshot;queued={state:snapshot,callbacks:[...(queued?.callbacks||[]),...(onSaved?[onSaved]:[])]};
   status();void flush();return true;
  },
  get pending(){return pending;},
  get revision(){return revision;},
  get failed(){return failed;}
 };
}
