export function isValidIsraeliId(id) {
  const s = String(id || '').trim().padStart(9, '0');
  if (!/^\d{9}$/.test(s) || s === '000000000') return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = Number(s[i]) * ((i % 2) + 1);
    if (digit > 9) digit -= 9;
    sum += digit;
  }
  return sum % 10 === 0;
}
