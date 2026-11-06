import { findBrand } from './providerBrands.js';
export function productKey(item) {
  const provider = findBrand(item.provider)?.name || String(item.provider || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  return JSON.stringify([provider, item.type || '', String(item.id || '')]);
}
export function dedupById(items) {
  const seen = new Map();
  for (const item of items) {
    const key = productKey(item);
    if (!seen.has(key)) seen.set(key, item);
  }
  return [...seen.values()];
}

// Format for display only; identity and deduplication retain the original identifier.
export function displayProductNumber(value) {
  const text = String(value ?? "");
  return /^\d+$/.test(text) ? text.replace(/^0+(?=\d)/, "") : text;
}
