// הסכמי דמי ניהול שדוד השיג מול חברות (מקור: "יופריסט" / הסכמי סוכנות)
// לא הערכה - זה מה שדוד בפועל יכול להשיג ללקוח מול כל חברה.
// להוסיף חברות נוספות כשמגיעים הסכמים נוספים.

// דוד יכול לתת לכל אחד, בכל חברה, ללא תלות בשכר: 1.5% מהפקדה / 0.15% מצבירה בפנסיה.
// כל לקוח שמשלם יותר מזה - משלם ביוקר, גם אם אין לחברה שלו הסכם ספציפי רשום למטה.
export const UNIVERSAL_PENSION_FEE = { feeFromDeposit: 1.5, feeFromAccumulation: 0.15, company: 'סוכנות (כל חברה)' };

export const agencyFeeAgreements = {
  'מנורה': {
    source: 'יופריסט',
    // מתווה סוכנות - פנסיה, לפי שכר (התניה)
    pension: [
      { salaryThreshold: 10000, feeFromDeposit: 1.90, feeFromAccumulation: 0.15 },
      { salaryThreshold: 17000, feeFromDeposit: 1.50, feeFromAccumulation: 0.12 },
      { salaryThreshold: 20000, feeFromDeposit: 1.50, feeFromAccumulation: 0.10 },
      { salaryThreshold: 120000, feeFromDeposit: 1.50, feeFromAccumulation: 0.15 },
    ],
    // מתווה סוכנות - גמל והשתלמות (ללא גמל להשקעה), לפי צבירה
    gemelHishtalmut: [
      { balanceThreshold: 0, feeFromAccumulation: 0.7 },
      { balanceThreshold: 250000, feeFromAccumulation: 0.65 },
    ],
  },

  'הראל': {
    source: 'מתווה דמי ניהול למצטרפים חדשים - הראל (החל מאפריל 2026)',
    // פנסיה, לפי שכר. עבור עצמאים: לחלק את סכום ההפקדה ב-0.2 כדי לקבל "שכר" מקביל.
    // ponytail: בשורה "+15,000 ₪" יש בהסכם 2 חלופות (0.08%/1.8% או 0.1%/1.5%) - נבחרה כאן החלופה עם דמי ניהול מצבירה נמוכים יותר.
    pension: [
      { salaryThreshold: 0, feeFromDeposit: 5.8, feeFromAccumulation: 0.48 },
      { salaryThreshold: 3000, feeFromDeposit: 4, feeFromAccumulation: 0.30 },
      { salaryThreshold: 6000, feeFromDeposit: 1.9, feeFromAccumulation: 0.19 },
      { salaryThreshold: 8000, feeFromDeposit: 1.7, feeFromAccumulation: 0.17 },
      { salaryThreshold: 10000, feeFromDeposit: 1.5, feeFromAccumulation: 0.15 },
      { salaryThreshold: 15000, feeFromDeposit: 1.5, feeFromAccumulation: 0.10 },
    ],
    // קרן השתלמות / קופת גמל רגילה, לפי צבירה
    gemelHishtalmut: [
      { balanceThreshold: 0, feeFromAccumulation: 0.7 },
      { balanceThreshold: 150000, feeFromAccumulation: 0.65 },
      { balanceThreshold: 300000, feeFromAccumulation: 0.6 },
      { balanceThreshold: 900000, feeFromAccumulation: 0.55 },
    ],
    // קופת גמל להשקעה, לפי צבירה
    gemelLehaskaa: [
      { balanceThreshold: 0, feeFromAccumulation: 0.7 },
      { balanceThreshold: 150000, feeFromAccumulation: 0.65 },
      { balanceThreshold: 300000, feeFromAccumulation: 0.6 },
      { balanceThreshold: 650000, feeFromAccumulation: 0.55 },
    ],
  },

  'הפניקס': {
    source: 'מסלול דמי ניהול משתנים - הפניקס, לפי צבירה אישית',
    // פנסיה, לפי צבירה (לא שכר!) - מסלול דינמי שיורד ככל שהצבירה עולה
    pensionByBalance: [
      { balanceThreshold: 0, feeFromDeposit: 1.5, feeFromAccumulation: 0.22 },
      { balanceThreshold: 150000, feeFromDeposit: 1.5, feeFromAccumulation: 0.18 },
      { balanceThreshold: 350000, feeFromDeposit: 1.5, feeFromAccumulation: 0.14 },
      { balanceThreshold: 600000, feeFromDeposit: 1.5, feeFromAccumulation: 0.10 },
    ],
  },
};

function matchCompanyKey(providerName) {
  if (!providerName) return null;
  return Object.keys(agencyFeeAgreements).find(key => providerName.includes(key)) || null;
}

function bestTierBelowOrEqual(tiers, thresholdField, value) {
  const sorted = [...tiers].sort((a, b) => a[thresholdField] - b[thresholdField]);
  return [...sorted].reverse().find(t => value >= t[thresholdField]) || null;
}

// מחזיר את הצעת דמי הניהול הטובה ביותר לפנסיה שדוד יכול להשיג - בין הסכם ספציפי לחברה (לפי שכר או לפי צבירה)
// לבין ההצעה האוניברסלית (1.5%/0.15% בכל חברה, ללא תלות בשכר). תמיד מחזיר תוצאה - לא תלוי בקיום הסכם ספציפי.
export function getAgencyPensionFee(providerName, { salary, balance } = {}) {
  const key = matchCompanyKey(providerName);
  const candidates = [UNIVERSAL_PENSION_FEE];

  if (key) {
    const company = agencyFeeAgreements[key];
    if (company.pension && salary != null) {
      const tier = bestTierBelowOrEqual(company.pension, 'salaryThreshold', salary);
      if (tier) candidates.push({ ...tier, company: key, source: company.source });
    }
    if (company.pensionByBalance && balance != null) {
      const tier = bestTierBelowOrEqual(company.pensionByBalance, 'balanceThreshold', balance);
      if (tier) candidates.push({ ...tier, company: key, source: company.source });
    }
  }

  return candidates.reduce((best, c) => (c.feeFromAccumulation < best.feeFromAccumulation ? c : best));
}

// מחזיר את ההסכם הטוב ביותר לגמל/השתלמות לפי צבירה, או null אם אין הסכם רשום לחברה הזו
// isInvestmentGemel=true -> טבלת "גמל להשקעה" אם קיימת לחברה, אחרת נופל לטבלת ההשתלמות/גמל הרגילה
export function getAgencyGemelFee(providerName, balance, isInvestmentGemel = false) {
  const key = matchCompanyKey(providerName);
  if (!key) return null;
  const company = agencyFeeAgreements[key];
  const table = (isInvestmentGemel && company.gemelLehaskaa) || company.gemelHishtalmut;
  if (!table) return null; // לחברה יש הסכם פנסיה בלבד (למשל הפניקס) - אין מה להציע לגמל/השתלמות
  const tier = bestTierBelowOrEqual(table, 'balanceThreshold', balance);
  return tier ? { ...tier, company: key, source: company.source } : null;
}
