export function scheduleService(client,start,occupied=[]){
 if(client.appointments.some(a=>a.annualService&&!a.done&&!a.cancelled))return client;
 const day=new Date(start);day.setFullYear(day.getFullYear()+1);day.setHours(15,0,0,0);
 let when;for(let i=0;i<366;i++){if(![5,6].includes(day.getDay())){for(let slot=0;slot<4;slot++){day.setHours(15+Math.floor(slot/2),(slot%2)*30,0,0);const local=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}T${String(day.getHours()).padStart(2,'0')}:${String(day.getMinutes()).padStart(2,'0')}`;if(!occupied.some(a=>!a.done&&!a.cancelled&&Math.abs(new Date(a.when)-day)<30*60000)){when=local;break;}}}if(when)break;day.setDate(day.getDate()+1);}
 if(!when)throw Error('לא נמצא חלון שירות פנוי ביומן הדמו');
 const preparation=new Date(day);preparation.setDate(preparation.getDate()-7);
 return {...client,appointments:[...client.appointments,{id:crypto.randomUUID(),title:'פגישת שירות שנתית',type:'פגישת שירות שנתית',annualService:true,when,duration:30,done:false,prepareOn:`${preparation.getFullYear()}-${String(preparation.getMonth()+1).padStart(2,'0')}-${String(preparation.getDate()).padStart(2,'0')}`,preparation:{},invitation:client.email?'הזמנה מדומה מוכנה':'חסר מייל להזמנה'}]};
}
