// השוואת "כמה נצבר לפרישה" בין 2 מבני דמי ניהול על אותו לקוח - נועד לתמוך בקארד
// "רוצה לדעת איך ניתן לשפר?" (Pension.jsx). שיטה אומתה מול מחשבון תשואה חיצוני (הפרש
// שוליים בלבד, נובע מתזמון הפקדה - ראה ההודעה בצ'אט מ-17/9/2026).
const DEFAULT_ANNUAL_RETURN = 0.04; // "כל שאר" המסלולים (לא המסלול הכללי המובטח, זה 4.38%)
const DEFAULT_RETIREMENT_AGE = 67;

export function monthsToRetirement(birthDateStr, retirementAge = DEFAULT_RETIREMENT_AGE) {
  const m = (birthDateStr || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, day, month, year] = m;
  const birth = new Date(Number(year), Number(month) - 1, Number(day));
  const retireDate = new Date(birth);
  retireDate.setFullYear(retireDate.getFullYear() + retirementAge);
  const now = new Date();
  const months = (retireDate.getFullYear() - now.getFullYear()) * 12 + (retireDate.getMonth() - now.getMonth());
  return months > 0 ? months : 0;
}

// balance: צבירה נוכחית. monthlyDeposit: הפקדה חודשית ברוטו (לפני דמי ניהול מהפקדה).
// feeFromDepositPct/feeFromAccumulationPct: אחוזים (2 = 2%, לא 0.02).
// הפקדה מונחת באמצע החודש (יום 15) - מכפיל ריבית חודשית חלקית (שורש g), לא חודש מלא ולא כלום.
export function projectRetirement({ balance, monthlyDeposit, feeFromDepositPct, feeFromAccumulationPct, months, annualReturn = DEFAULT_ANNUAL_RETURN }) {
  if (!months || months <= 0) return balance;
  const r = Math.pow(1 + annualReturn, 1 / 12) - 1;
  const f = (feeFromAccumulationPct || 0) / 100 / 12;
  const g = 1 + r - f;
  const netDeposit = (monthlyDeposit || 0) * (1 - (feeFromDepositPct || 0) / 100);
  const gPowN = Math.pow(g, months);
  const balanceTerm = balance * gPowN;
  const annuityTerm = netDeposit * (gPowN - 1) / (g - 1) * Math.sqrt(g);
  return balanceTerm + annuityTerm;
}
