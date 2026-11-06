import * as XLSX from 'xlsx';
import { filesFromUploads, processMaslakaFiles, processHarBituachBuffer } from '../lib/maslakaCards';
import { normalizeIsraeliId } from '../lib/israeliId';
import { portfolio } from './model';
import { enrichProductDates } from './productDates';
const masked = id => id ? `•••••${String(id).slice(-4)}` : 'ללא מזהה';
export async function parseSource(file) {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    // Preserve identifiers from the underlying value, never Excel's rounded display text.
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    for (const address of Object.keys(sheet)) {
      if (!/^J[0-9]+$/.test(address)) continue;
      const cell = sheet[address];
      if (cell.t === 'n' && Number.isSafeInteger(cell.v)) {
        cell.t = 's'; cell.v = String(cell.v); delete cell.w; delete cell.z;
      }
    }
    const cells = Object.keys(sheet).filter(address => /^[A-Z]+[0-9]+$/.test(address)).map(XLSX.utils.decode_cell);
    if (cells.length) sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(...cells.map(c => c.r)), c: Math.max(...cells.map(c => c.c)) } });
    const groups = processHarBituachBuffer(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));
    return [...groups].map(([id, cards]) => ({ source: 'file', client_info: { id }, pension_data: [], insurance_data: [], har_bituach_data: cards, label: `${file.name} · ${masked(id)}`, kind: 'insurance', profile: {} }));
  }
  const entries = await filesFromUploads([file]);
  // Separate clients before calling the shared parser: never join identities.
  const groups = new Map();
  for (const entry of entries) {
    const doc = new DOMParser().parseFromString(entry.text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('קובץ XML לא תקין');
    const ids = [...new Set([...doc.getElementsByTagName('MISPAR-ZIHUY-LAKOACH')].map(e => normalizeIsraeliId(e.textContent)).filter(id => id !== '000000000'))];
    if (ids.length > 1) throw new Error('קובץ XML מכיל כמה לקוחות. יש לפצל אותו לפני הטעינה.');
    const id = ids[0] || entry.name;
    groups.set(id, [...(groups.get(id) || []), entry]);
  }
  return [...groups.entries()].map(([id, group]) => {
    const data = processMaslakaFiles(group);
    const clientInfo = { ...data.clientInfo, ...(/^\d{9}$/.test(id) ? { id } : {}) };
    return { source: 'file', client_info: clientInfo, pension_data: enrichProductDates(data.pensionCards, group), insurance_data: data.insuranceCards, har_bituach_data: [], label: `${file.name} · ${clientInfo.first || masked(clientInfo.id)}`, kind: 'maslaka', profile: {} };
  }).filter(item => portfolio(item).funds.length || portfolio(item).policies.length);
}

