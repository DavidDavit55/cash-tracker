// Detect compensation benefits from the product details, not the broad health category.
export function isCompensationPolicy(policy) {
  const text = [policy.name, ...(policy.coverageItems || [])].join(' ').normalize('NFKC');
  return ['life', 'disability', 'accident', 'critical_illness'].includes(policy.type)
    || /מחלות\s*קשות|מחלה\s*קשה|פיצוי|critical\s*illness/i.test(text);
}

export function showCoverageAmount(policy) {
  return isCompensationPolicy(policy) || (policy.type !== 'health' && policy.coverage != null);
}
