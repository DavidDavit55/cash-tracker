// Deduplicate insurance only. Pension accounts can share an ID across products.
function key(p) {
  const company = ['איילון','הראל','הפניקס','מנורה','כלל','מגדל'].find(n => (p.provider || '').includes(n)) || p.provider?.trim();
  return company && p.id ? `${company}:${String(p.id).trim()}` : null;
}
export function uniqueInsuranceReports(reports) {
  const matches = new Map();
  for (const report of reports) for (const field of ['insuranceData','harBituachData']) for (const p of report.payload[field] || []) {
    const id = key(p); if (!id) continue;
    const list = matches.get(id) || []; list.push({ report, p }); matches.set(id, list);
  }
  return reports.map(report => ({ ...report, payload: Object.fromEntries(Object.entries(report.payload).map(([field, rows]) => [field,
    !['insuranceData','harBituachData'].includes(field) ? rows : rows.flatMap(p => {
      const entries = matches.get(key(p)) || [];
      if (new Set(entries.map(e => e.report.source)).size < 2) return [p];
      const winner = [...entries].sort((a,b) => b.report.as_of_date.localeCompare(a.report.as_of_date))[0];
      if (winner.report.id !== report.id) return [];
      return [{ ...p, alsoReportedIn: entries.filter(e => e.report.id !== report.id).map(e => ({ source:e.report.source, date:e.report.as_of_date })) }];
    })
  ])) }));
}
