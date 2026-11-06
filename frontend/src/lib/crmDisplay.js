import {findBrand} from '../sandbox/providerBrands.js';

// Presentation only: never use this as an import key, API identifier or stored ID.
// Keep at least nine digits, including a legitimate leading zero in an Israeli ID.
export function policyDisplay(value) {
 const text=String(value??'').trim();
 return /^\d{10,}$/.test(text)?text.replace(/^0+(?=\d{9})/,''):text;
}
export const providerName=value=>findBrand(value)?.name||String(value??'').trim();
export const providerLogo=value=>findBrand(value)?.file||null;

// Placeholder-only rows are not coverages. Preserve unnamed rows with real amounts.
export const hasCoverageName=value=>!!String(value??'').trim()&&!/^[-–—־\s]+$/.test(String(value).trim());
export const visibleCoverages=rows=>(rows||[]).filter(row=>row&&(hasCoverageName(row.name)||[row.amount,row.premium].some(v=>v!=null&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>0)));

// Operational choices, not a claim that every company offers every coverage.
// Savings routes use the public Pension/Gemel catalogue, not a made-up fund list.
const insurers=['הראל','הפניקס','מנורה מבטחים','כלל','מגדל','איילון','הכשרה','ביטוח ישיר — איי די איי','AIG'];
const savings=['הראל','הפניקס','מנורה מבטחים','כלל','מגדל','מיטב','מור','אלטשולר שחם','ילין לפידות','אנליסט','אינפיניטי'];
export function providerOptions(category,...extraNames) {
 const base=['פנסיה','השתלמות','גמל','גמל להשקעה'].includes(category)?savings:insurers;
 return [...new Set([...base,...extraNames.flat().filter(Boolean)])];
}
