export function meetingDateFor(client){
 if(client.meetingDate)return client.meetingDate;
 const meetings=(client.appointments||[]).filter(a=>!a.annualService&&['פגישת המלצות','בדיקת תיק פנסיוני'].includes(a.type)&&a.when);
 return meetings.length===1?meetings[0].when.slice(0,10):'';
}
export function reportEmail(client){
 const reports=(client.reports||[]).filter(r=>r.source==='maslaka');
 const emails=[...new Set(reports.flatMap(r=>r.customerEmails||[]))];
 return emails.length===1?emails[0]:emails.length?'נמצאו כמה כתובות: '+emails.join(', '):'לא נמצאה כתובת במסלקה — ניתן להעלות שוב את הקובץ לחילוץ';
}
