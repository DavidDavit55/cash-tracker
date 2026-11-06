// Display rule only: never infer an insured amount from premiums or coverage text.
export function showInsuranceAmount(product) {
  const text = [product.name, ...(product.coverageItems || [])].join(' ');
  if (/מחלות קשות|מחלה קשה/.test(text)) return true;
  return product.type !== 'health' && !/בריאות/.test(product.name || '');
}
