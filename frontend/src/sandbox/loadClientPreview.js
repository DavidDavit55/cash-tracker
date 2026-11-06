import { parseSource } from './parseSource';
import { dedupById } from './productIdentity';

export async function loadClientPreview(signal) {
  const groups = (await Promise.all(['maslaka.zip', 'insurance.xlsx'].map(async name => {
    const response = await fetch(`/sandbox-client-preview/${name}`, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error('לא ניתן לטעון את תיק הלקוח. נסה לרענן את העמוד.');
    return parseSource(new File([await response.blob()], name));
  }))).flat();
  const ids = new Set(groups.map(group => group.client_info?.id).filter(Boolean));
  if (ids.size !== 1 || groups.some(group => !group.client_info?.id)) throw new Error('הקבצים אינם שייכים לתיק לקוח יחיד.');
  const combined = { source: 'file', client_info: {}, profile: {}, pension_data: [], insurance_data: [], har_bituach_data: [], warnings: [], loadedAt: new Date().toISOString() };
  for (const group of groups) {
    Object.assign(combined.client_info, group.client_info);
    for (const key of ['pension_data', 'insurance_data', 'har_bituach_data']) combined[key] = dedupById([...combined[key], ...(group[key] || [])]);
  }
  return combined;
}
