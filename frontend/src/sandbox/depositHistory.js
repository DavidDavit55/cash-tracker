const valid = value => value && value !== 'NULL' && !/^0+$/.test(value);
const cents = value => value != null && /^-?\d+(\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : null;
const month = value => /^\d{6}$/.test(value || '') && Number(value.slice(4)) >= 1 && Number(value.slice(4)) <= 12 ? value : null;
export function depositDate(value) {
  if (!/^\d{8}$/.test(value || '')) return null;
  const date = new Date(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6)));
  return date.getFullYear() === Number(value.slice(0, 4)) && date.getMonth() + 1 === Number(value.slice(4, 6)) && date.getDate() === Number(value.slice(6)) ? value : null;
}
export const displayDepositDate = value => value ? `${value.slice(6)}/${value.slice(4, 6)}/${value.slice(0, 4)}` : null;

export function summarizeDeposits(rows) {
  const salary = new Map(), received = new Map();
  let transferCents = 0, otherCents = 0, invalidRows = 0;
  let last = null;
  const transactions = [];
  const add = (map, key, row) => {
    if (!map.has(key)) map.set(key, { key, cents: 0, dates: new Set() });
    const item = map.get(key); item.cents += row.cents;
    if (row.date) item.dates.add(row.date);
  };
  for (const row of rows) {
    const amount = cents(row.amount), date = depositDate(row.date), wageMonth = month(row.wageMonth);
    if (amount == null) { invalidRows++; continue; }
    const transfer = valid(row.transferringFund) || valid(row.transferDate);
    const kind = transfer ? 'transfer' : wageMonth ? 'salary' : 'other';
    transactions.push({ ...row, date, wageMonth, amount: amount / 100, kind });
    if (transfer) { transferCents += amount; continue; }
    if (!wageMonth) { otherCents += amount; continue; }
    add(salary, wageMonth, { cents: amount, date });
    if (date) {
      add(received, date.slice(0, 6), { cents: amount, date });
      if (!last || date > last) last = date;
    }
  }
  const series = map => [...map.values()].sort((a, b) => a.key.localeCompare(b.key)).map(item => ({ key: item.key, month: `${item.key.slice(4)}/${item.key.slice(2, 4)}`, amount: item.cents / 100, dates: [...item.dates].sort().map(displayDepositDate) }));
  return { deposits: series(salary), receivedDeposits: series(received), lastDepositDate: displayDepositDate(last), transferTotal: transferCents / 100, otherTotal: otherCents / 100, invalidRows, depositTransactions: transactions };
}

export function readDepositHistory(account) {
  const read = (node, tag) => [...node.children].find(child => child.localName === tag)?.textContent.trim() || null;
  // Use the detailed year-to-date rows only. Last-deposit summaries repeat them.
  // Preserve equal rows: without a transaction ID, equality is not proof of duplication.
  const rows = [...account.getElementsByTagName('PerutHafkadotMetchilatShana')].map(node => ({
    amount: read(node, 'SCHUM-HAFKADA-SHESHULAM'), date: read(node, 'TAARICH-ERECH-HAFKADA'),
    wageMonth: read(node, 'CHODESH-SACHAR'), component: read(node, 'SUG-HAFRASHA'),
    transferringFund: read(node, 'KOD-MEZAHE-KOPA-MAAVIRA'), transferDate: read(node, 'MOED-KOVEA-NIUD'),
  }));
  return summarizeDeposits(rows);
}
