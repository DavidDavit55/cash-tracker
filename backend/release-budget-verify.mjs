import 'dotenv/config';
import jwt from 'jsonwebtoken';
import {readFileSync} from 'node:fs';
const base='https://cash-tracker-production-35dd.up.railway.app/api';
const token=jwt.sign({id:'b890f68f-5bdd-4d67-ac5b-16fe95ac16f0'},process.env.JWT_SECRET,{expiresIn:'5m'});
const headers={authorization:`Bearer ${token}`};
const local=JSON.parse(readFileSync('../.release/20260927-private/local.json')).tables;
const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'});
const periods=new Set([...local.expenses.map(r=>fmt.format(new Date(r.expense_date)).slice(0,7)),...local.incomes.map(r=>fmt.format(new Date(r.income_date)).slice(0,7))]);
let expenses=0,incomes=0;
for(const period of periods){const response=await fetch(`${base}/budget-workspace/overview?period=${period}`,{headers});if(!response.ok)throw Error(`Overview HTTP ${response.status}`);const data=await response.json();for(const t of ['expenses','incomes']){const key=t==='expenses'?'expense_date':'income_date';for(const row of local[t].filter(r=>fmt.format(new Date(r[key])).startsWith(period))){const actual=data[t].find(r=>r.id===row.id);if(!actual)throw Error('Missing '+t+' '+row.id);for(const field of ['amount','description','merchant','source','notes','payment_method','includes_vat'].filter(k=>k in row)){if(String(actual[field]??'')!==String(row[field]??''))throw Error('Mismatch '+t+' '+field);}if(actual[key]!==fmt.format(new Date(row[key])))throw Error('Date mismatch');}if(t==='expenses')expenses+=data[t].length;else incomes+=data[t].length;}}
const denied=await fetch(`${base}/budget-workspace/overview?period=2026-09`);if(denied.status!==401)throw Error('Auth guard failed');
console.log(JSON.stringify({verified:true,expenses,incomes,periods:periods.size,unauthenticated:denied.status}));
