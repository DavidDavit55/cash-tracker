// Stable, public-field-only representation used by the CRM and the calendar mirror.
export function appointmentSyncVersion(client, appointment) {
  return JSON.stringify([String(client?.name||''),String(appointment?.title||''),String(appointment?.type||''),String(appointment?.when||''),String(appointment?.mode||''),!!appointment?.cancelled]);
}
export function changeAppointment(client,id,patch,at=new Date().toISOString()) {
  const previous=client.appointments?.find(a=>a.id===id);
  if(!previous||previous.done||previous.cancelled)throw Error('לא ניתן לערוך פגישה שהסתיימה או בוטלה.');
  const cancel=patch.cancelled===true;
  const next=cancel?{...previous,cancelled:true,cancelledAt:at,cancellationReason:String(patch.reason||'').trim().slice(0,240)}:{...previous,title:String(patch.title||'').trim().slice(0,120),type:String(patch.type||previous.type||'').slice(0,80),when:String(patch.when||''),mode:String(patch.mode||'').slice(0,30),updatedAt:at};
  if(!cancel&&(!next.title||!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(next.when)||!Number.isFinite(Date.parse(next.when))))throw Error('יש למלא נושא ותאריך ושעה תקינים.');
  const audit={at,action:cancel?'cancel':'edit',before:{title:previous.title,type:previous.type,when:previous.when,mode:previous.mode},after:{title:next.title,type:next.type,when:next.when,mode:next.mode,cancelled:!!next.cancelled},reason:next.cancellationReason||''};
  return {...client,appointments:client.appointments.map(a=>a.id===id?{...next,history:[...(previous.history||[]),audit]}:a)};
}
