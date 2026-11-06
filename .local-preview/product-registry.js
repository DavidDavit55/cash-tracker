export function classifyProduct(p) {
  const covers = (p.coverageItems || []).join(' ');
  if (p.name === 'ביטוח בריאות' && p.coverageItems?.length === 1) {
    if (/מחלות קשות|מחלה קשה/.test(covers)) return {...p,name:'מחלות קשות'};
    if (/תאונות אישיות/.test(covers)) return {...p,name:'תאונות אישיות'};
  }
  return {...p};
}
export function unifiedProducts(reports) {
  const products = new Map();
  for (const report of reports) for (const [field,rows] of Object.entries(report.payload)) for (const [i,raw] of rows.entries()) {
    const p = classifyProduct(raw);
    const company = ['איילון','הראל','הפניקס','מנורה','כלל','מגדל'].find(n=>(p.provider||'').includes(n)) || p.provider;
    const key = field === 'pensionData' ? `${report.source}:${field}:${p.provider}:${p.id}:${i}` : company && p.id ? `${company}:${String(p.id).trim()}` : `${report.id}:${field}:${i}`;
    const entry = products.get(key) || {key,field,snapshots:[]};
    entry.snapshots.push({product:p,source:report.source,date:report.as_of_date,reportId:report.id});
    products.set(key,entry);
  }
  return [...products.values()].map(entry=>{
    entry.snapshots.sort((a,b)=>b.date.localeCompare(a.date)||a.source.localeCompare(b.source));
    const latest=entry.snapshots[0];
    return {...latest.product,productKey:entry.key,productField:entry.field,source:latest.source,asOf:latest.date,snapshots:entry.snapshots};
  });
}
