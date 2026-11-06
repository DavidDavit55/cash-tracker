import {businessDate,israelDate} from './workflow-process.js';
export const DEMO_KEY='networth-pension-walkthrough-v1';
export const allocation='50% מניות · 25% מניות סחיר · 25% S&P 500';
export const fresh=()=>({version:1,decisions:{pension:'pending',training:'pending'},notes:'',events:[],files:[],started:israelDate()});
export const next20=date=>{const d=new Date(date+'T12:00:00');return `${d.getFullYear()+(d.getMonth()===11?1:0)}-${String(d.getMonth()===11?1:d.getMonth()+2).padStart(2,'0')}-20`;};
export function summary(s){return `שלום ${s.client?.name||'לקוח הדגמה'},\nסיכום פגישתנו:\n\nפנסיה מקיפה\nמצב קיים: הפניקס, 1.5% מהפקדה ו־0.15% מצבירה, מסלול לבני 50 ומטה.\nהמלצה: הצטרפות להראל עם ניוד, 1% מהפקדה ו־0.1% מצבירה.\nחלוקת השקעות: ${allocation}.\nהחלטה: ${s.decisions.pension==='yes'?'הלקוח אישר להתקדם':'הלקוח בחר שלא להתקדם'}.\n\nהשתלמות\nהמלצה: מינוי סוכן בלבד, ללא שינוי בתנאים או במסלול.\nהחלטה: ${s.decisions.training==='yes'?'הלקוח אישר להתקדם':'הלקוח בחר שלא להתקדם'}.${s.notes?'\n\n'+s.notes:''}\n\nדוד · NETWORTH\nהדגמה סינתטית בלבד — אין שליחה אמיתית.`;}
export function tasks(s){
 const rows=[];const add=(id,title,due,area)=>rows.push({id,title,due,area});
 if(!s.summarySent)return rows;
 const p=s.decisions.pension==='yes',t=s.decisions.training==='yes';
 if(!(p||t))return rows;
 if(!s.kitSent)add('kit',s.idAttached?'שליחת הקיט לחתימה':'בקשת צילום ת״ז וצירופו לקיט',israelDate(),'kit');
 else if(!s.submitted)add('signature','מעקב חתימות ושליחה ב־SMS 2010',businessDate(s.kitSent,2),'kit');
 else {
  if(t&&!s.agentVerified)add('agent','בדיקת קליטת מינוי ההשתלמות באתר החברה',businessDate(s.submitted,10),'training');
  if(t&&s.agentVerified&&!s.agentUpdated)add('agent-update','עדכון הלקוח על מינוי ההשתלמות',s.agentVerified,'training');
  if(p&&!s.payrollSent)add('payroll','נספח ו׳ וטופס קוביות לחשבת השכר',israelDate(),'pension');
  if(p&&s.payrollSent&&!s.deposit)add('deposit','בדיקת הפקדה ראשונה בהראל',next20(s.payrollSent),'pension');
  if(p&&s.deposit&&!s.transferred)add('transfer','בדיקת קבלת כספי הניוד מהפניקס',businessDate(s.deposit,10),'pension');
  if(p&&s.transferred&&!s.clientCalled)add('call','שיחת עדכון ללקוח על השלמת הפנסיה',s.transferred,'pension');
 }
 return rows;
}
export function transition(s,type,data={},date=israelDate()){
 const require=(ok,msg)=>{if(!ok)throw Error(msg);};let patch={};let label='';
 const p=s.decisions.pension==='yes',t=s.decisions.training==='yes';
 switch(type){
 case 'lead':{
  require(data.name?.trim()&&/^0\d{8,9}$/.test((data.phone||'').replace(/\D/g,'')),'יש להזין שם וטלפון תקין לדוגמה');
  const {archives=[],...previous}=s;
  return {...fresh(),archives:previous.client||previous.events.length?[...archives,previous]:archives,client:{name:data.name.trim(),phone:data.phone,source:data.source,topic:data.topic},events:[{at:new Date().toISOString(),date,text:'ליד חדש נפתח בדמו — '+data.name.trim()}]};
 }
 case 'intake-call':require(s.client,'יש לפתוח ליד');require(data.notes?.trim()&&data.when,'יש לתעד שיחה ומועד פגישה');require(!s.information,'נתוני השיחה כבר שימשו לקליטת המידע בדוגמה');patch={call:{notes:data.notes,id:data.id,birth:data.birth,issued:data.issued,permission:data.permission||'not-recorded'},appointment:{when:data.when,type:data.kind}};label='תועדה שיחה ראשונה ונקבעה פגישה מקומית: '+data.when;break;
 case 'information':require(s.call&&s.appointment,'יש לתעד שיחת היכרות ולקבוע פגישה');require(s.call.id&&s.call.birth&&s.call.issued&&s.call.permission!=='not-recorded','להדמיית קבלת מידע יש להשלים פרטי זיהוי ומצב הרשאה; ניתן לשמור שיחה גם כשחסרים');patch={information:true,client:{...s.client,email:'demo@example.com'}};label='נטענו נתוני דוגמה סינתטיים למסלקה ולהר הביטוח — לא הוזמן מידע אמיתי';break;
 case 'decision':require(!s.summarySent,'הסיכום שנשלח נעול בדוגמה זו');require(['pension','training'].includes(data.product)&&['yes','no'].includes(data.value),'בחירה לא תקינה');patch={decisions:{...s.decisions,[data.product]:data.value}};label='תועדה החלטת לקוח — '+(data.product==='pension'?'פנסיה':'השתלמות');break;
 case 'notes':require(!s.summarySent,'הסיכום שנשלח נעול');patch={notes:data.text.slice(0,400)};break;
 case 'summary':require(!Object.values(s.decisions).includes('pending'),'יש לתעד החלטה לכל מוצר');require(!s.summarySent,'הסיכום כבר נשלח בדמו');patch={summarySent:date,sentSummary:summary(s)};label='סיכום פגישה נשלח בדמו ל־'+(s.client?.email||'demo@example.com');break;
 case 'id':require(!s.kitSent,'הקיט כבר נשלח');patch={idAttached:!s.idAttached};break;
 case 'wa':require(s.summarySent,'קודם סיכום');patch={waPrepared:true};label='הודעת וואטסאפ הוכנה — לא נשלחה';break;
 case 'kit':require((p||t)&&s.summarySent&&s.idAttached&&s.waPrepared,'נדרשים סיכום, צילום ת״ז מצורף והודעה מוכנה');require(!s.kitSent,'הקיט כבר נשלח');patch={kitSent:date};label='דימוי שליחת קיט מאוחד לחתימה דרך SMS 2010';break;
 case 'submit':require(s.kitSent&&!s.submitted,'נדרש קיט ממתין לחתימה');patch={submitted:date};label='דימוי חתימות הלקוח והסוכן; וידוא השליחה האוטומטית לחברות';break;
 case 'annex':require(p&&s.submitted&&!s.annex,'נדרשת הגשת הפנסיה');patch={annex:true,files:[...s.files,{name:'נספח ו׳ + טופס קוביות — מסמכי הדגמה',body:'נתוני דוגמה בלבד. מסמכי הדגמה לקראת משלוח לחשבת השכר. אינם טפסים לשימוש.'}]};label='נקלטו מסמכי הדגמה: נספח ו׳ וטופס קוביות';break;
 case 'payroll':require(s.annex&&!s.payrollSent,'נדרשים נספח ו׳ וטופס קוביות');require(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email||''),'נדרשת כתובת חשבת שכר תקינה');patch={payrollSent:date,payrollEmail:data.email};label='דימוי שליחת המייל לחשבת השכר: '+data.email;break;
 case 'deposit':require(s.payrollSent&&!s.deposit,'נדרשת שליחה לחשבת השכר');patch={deposit:date,depositActual:2100};label='דימוי בדיקה באתר: התקבלה הפקדה ראשונה של 2,100 ₪ (נתון סינתטי)';break;
 case 'transfer':require(s.deposit&&!s.transferred,'הפקדה ראשונה נדרשת לפני אימות הניוד מהמקור הפעיל');patch={transferred:date,received:148500,files:[...s.files,{name:'אישור ניוד — אסמכתה סינתטית',body:'הדגמה בלבד: סכום מקור 148,500 ₪. סכום שהתקבל 148,500 ₪. אין תוקף כאישור חברה.'}]};label='דימוי אימות ניוד מלא: 148,500 ₪; אסמכתה סינתטית נשמרה; הפניקס הועברה להיסטוריה';break;
 case 'agent':require(t&&s.submitted&&!s.agentVerified,'נדרשת הגשת מינוי');patch={agentVerified:date};label='דימוי בדיקה באתר כלל: המוצר מופיע תחת דוד, ללא שינוי בתנאים';break;
 case 'agent-update':require(s.agentVerified&&!s.agentUpdated,'יש לאמת מינוי');patch={agentUpdated:date};label='מייל עדכון מינוי נשלח בדמו; הודעת וואטסאפ מוכנה';break;
 case 'call':require(s.transferred&&!s.clientCalled,'נדרש אימות ניוד');patch={clientCalled:date};label='תועדה שיחת עדכון על השלמת הפנסיה בדמו';break;
 default:throw Error('פעולה לא מוכרת');
 }
 return {...s,...patch,events:label?[...s.events,{at:new Date().toISOString(),date,text:label}]:s.events};
}
