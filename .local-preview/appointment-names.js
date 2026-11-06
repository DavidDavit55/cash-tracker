export function appointmentName(value){
 return ({'פגישת המלצות':'בדיקת תיק פנסיוני','פגישת שירות':'פגישת שירות שנתית','פגישת שירות פנסיונית':'פגישת שירות שנתית'})[value]||value;
}
export function appointmentNames(state){
 return {...state,clients:state.clients.map(c=>({...c,appointments:(c.appointments||[]).map(a=>({...a,type:appointmentName(a.type),title:appointmentName(a.title)}))}))};
}
export function summaryMeetingName(client){
 if(client.meetingType)return appointmentName(client.meetingType);
 const meetings=(client.appointments||[]).filter(a=>client.meetingDate&&a.when?.slice(0,10)===client.meetingDate);
 const types=[...new Set(meetings.map(a=>appointmentName(a.type)).filter(Boolean))];
 return types.length===1?types[0]:'בדיקת תיק פנסיוני';
}
