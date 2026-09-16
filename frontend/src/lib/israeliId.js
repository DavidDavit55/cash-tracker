// לצורך השוואה/התאמה בין מקורות שונים (מסלקה, הר ביטוח, טופס הרשמה) - כל אחד עלול לשמור
// את הת.ז בפורמט שונה (עם/בלי אפסים מובילים, ריפוד ל-16 ספרות בקובצי XML וכו').
// מייצר תמיד ייצוג קנוני של 9 ספרות כדי שההשוואה תעבוד בלי קשר לפורמט המקור.
export function normalizeIsraeliId(id) {
  const digitsOnly = String(id || '').replace(/\D/g, '');
  const trimmed = digitsOnly.replace(/^0+/, '') || '0';
  return trimmed.padStart(9, '0');
}

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
