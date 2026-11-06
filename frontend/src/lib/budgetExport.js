// Read-only export of the same income/expense ledger shown in the budget.
export function exportMonths(from,to){
 const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(!valid(from)||!valid(to)||from>to)throw new Error('יש לבחור טווח תאריכים תקין');
 const months=[];let year=Number(from.slice(0,4)),month=Number(from.slice(5,7));
 while(`${year}-${String(month).padStart(2,'0')}`<=to.slice(0,7)){
  months.push(`${year}-${String(month).padStart(2,'0')}`);
  if(months.length>120)throw new Error('אפשר לייצא עד עשר שנים בכל קובץ');
  if(++month===13){month=1;year++;}
 }
 return months;
}
export async function collectBudgetExport(apiClient,from,to,kind='all'){
 if(!['all','income','expense'].includes(kind))throw new Error('סוג תנועות לא תקין');
 const rows=[],seen=new Set();
 for(const period of exportMonths(from,to)){
  const {data}=await apiClient.get(`/budget-workspace/overview?period=${period}`);
  if(!Array.isArray(data.expenses)||!Array.isArray(data.incomes))throw new Error('נתוני התקציב לא נטענו במלואם');
  for(const type of ['income','expense']){
   if(kind!=='all'&&kind!==type)continue;
   for(const row of data[type==='income'?'incomes':'expenses']){
    const date=String(row[type==='income'?'income_date':'expense_date']||'').slice(0,10);
    if(date<from||date>to)continue;
    const key=row.id==null?null:`${type}:${row.id}`;
    if(key&&seen.has(key))continue;
    if(key)seen.add(key);
    const amount=Number(row.amount);
    if(!Number.isFinite(amount))throw new Error('נמצאה תנועה עם סכום לא תקין; הייצוא נעצר');
    rows.push({date,type,amount,label:row.merchant||row.description||row.source||'ללא תיאור',category:row.category_name||(data.categories||[]).find(c=>String(c.id)===String(row.category_id))?.name||row.source||'ללא קטגוריה',payment:row.payment_method||''});
   }
  }
 }
 rows.sort((a,b)=>a.date.localeCompare(b.date)||a.type.localeCompare(b.type));
 return rows;
}
export function exportTotals(rows){
 const cents=type=>rows.filter(r=>r.type===type).reduce((sum,r)=>sum+Math.round(r.amount*100),0);
 const income=cents('income'),expense=cents('expense');
 return {income:income/100,expense:expense/100,balance:(income-expense)/100};
}

// Raster pages preserve browser-native Hebrew shaping without sending financial
// data to a PDF service. The PDF is intended for printing and handwritten review.
export function budgetPdf(rows,{from,to,kind='all'},createCanvas=()=>document.createElement('canvas')){
 const W=1240,H=1754,margin=55,bottom=1620,line=28;
 const canvas=createCanvas();canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d');
 const money=n=>Number(n).toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2});
 const date=s=>s.split('-').reverse().join('/');
 const label={all:'הכנסות והוצאות',income:'הכנסות בלבד',expense:'הוצאות בלבד'}[kind];
 const totals=exportTotals(rows),pages=[];
 const widths=[50,120,80,390,210,145,135];
 const headers=['סימון','תאריך','סוג','תיאור','קטגוריה / תשלום','סכום בש״ח','הערות'];
 function text(value,x,y,size=21,bold=false){ctx.font=`${bold?'bold ':''}${size}px Arial`;ctx.fillStyle='#203448';ctx.direction='rtl';ctx.textAlign='right';ctx.fillText(String(value),x,y);}
 function wrap(value,width){
  ctx.font='21px Arial';const result=[];let current='';
  for(const word of String(value).split(/\s+/)){
   if(ctx.measureText(`${current} ${word}`.trim()).width<=width){current=`${current} ${word}`.trim();continue;}
   if(current){result.push(current);current='';}
   for(const char of word){if(ctx.measureText(current+char).width>width&&current){result.push(current);current='';}current+=char;}
  }
  if(current)result.push(current);return result.length?result:[''];
 }
 let y=0;
 function start(){
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);
  text('NETWORTH | דוח תנועות תקציב',W-margin,85,34,true);
  text(`${date(from)} - ${date(to)} | ${label} | ${rows.length} תנועות`,W-margin,130,23);
  text(`הכנסות: ${money(totals.income)}    הוצאות: ${money(totals.expense)}    הפרש: ${money(totals.balance)}`,W-margin,185,24,true);
  text('הסכומים בש״ח. הפרש הכנסות והוצאות אינו יתרת חשבון הבנק.',W-margin,222,19);
  ctx.fillStyle='#edf1f8';ctx.fillRect(margin,250,W-margin*2,52);
  let x=W-margin;headers.forEach((h,i)=>{text(h,x-8,282,i===4?17:19,true);x-=widths[i];});y=302;
 }
 function finish(){
  text(`עמוד ${pages.length+1} | דוח אישי - לשימוש בעל החשבון`,W-margin,H-55,19);
  pages.push(Uint8Array.from(atob(canvas.toDataURL('image/jpeg',0.94).split(',')[1]),c=>c.charCodeAt(0)));
 }
 start();
 for(const row of rows){
  const cells=[[],[date(row.date)],[row.type==='income'?'הכנסה':'הוצאה'],wrap(row.label,widths[3]-20),wrap([row.category,row.payment].filter(Boolean).join(' / '),widths[4]-20),wrap(money(row.amount),widths[5]-20),[]];
  const count=Math.max(1,...cells.map(c=>c.length));let offset=0;
  // Keep an ordinary transaction together; split only exceptionally long text.
  const wholeHeight=Math.max(68,count*line+24);
  if(y+wholeHeight>bottom&&wholeHeight<=bottom-302){finish();start();}
  while(offset<count){
   if(y+68>bottom){finish();start();}
   const take=Math.min(count-offset,Math.max(1,Math.floor((bottom-y-24)/line)));
   const height=Math.max(68,take*line+24);let x=W-margin;
   ctx.strokeStyle='#ccd3db';ctx.lineWidth=1;
   cells.forEach((cell,i)=>{
    ctx.strokeRect(x-widths[i],y,widths[i],height);
    if(i===0&&offset===0)ctx.strokeRect(x-34,y+24,18,18);
    cell.slice(offset,offset+take).forEach((value,j)=>text(value,x-10,y+30+j*line));x-=widths[i];
   });y+=height;offset+=take;
  }
 }
 finish();
 return jpegPagesPdf(pages,W,H);
}

export function jpegPagesPdf(pages,width,height){
 const encoder=new TextEncoder(),chunks=[],offsets=[0];let length=0;
 const put=value=>{const bytes=typeof value==='string'?encoder.encode(value):value;chunks.push(bytes);length+=bytes.length;};
 const object=(id,body)=>{offsets[id]=length;put(`${id} 0 obj\n`);put(body);put('\nendobj\n');};
 put('%PDF-1.4\n');
 object(1,'<< /Type /Catalog /Pages 2 0 R >>');
 object(2,`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
 pages.forEach((bytes,i)=>{
  const id=3+i*3;
  object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`);
  offsets[id+1]=length;put(`${id+1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);put(bytes);put('\nendstream\nendobj\n');
  const commands='q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';
  object(id+2,`<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`);
 });
 const xref=length;put(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
 offsets.slice(1).forEach(n=>put(`${String(n).padStart(10,'0')} 00000 n \n`));
 put(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
 return new Blob(chunks,{type:'application/pdf'});
}
