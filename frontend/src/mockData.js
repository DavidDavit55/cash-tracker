// נתוני דמו זמניים ל-NETWORTH — יוחלפו בחיבור אמיתי (Open Finance / מסלקת הר ביטוח)

export const AGENT_WHATSAPP = '972500000000'; // TODO: להחליף במספר האמיתי של הסוכן - עדיין בשימוש ב-CoverageGapWidget

export const CALENDLY_URL = 'https://calendly.com/david-davit-fin/30min';
export const CTA_LABEL = 'קבע פגישה עם מתכנן פנסיוני';

// שם ומייל הלקוח מוזרמים לקישור (?name=&email=) כדי שיהיו כבר ממולאים בדף התיאום -
// שם האירוע עצמו ("בדיקת תיק"/"תכנון פנסיוני") נקבע פעם אחת בהגדרות Calendly עצמו, לא כאן.
export function buildCalendlyLink(clientName, clientEmail) {
  const params = new URLSearchParams();
  params.set('timezone', 'Asia/Jerusalem'); // כופה שעון ישראל, לא תלוי בזיהוי דפדפן של הלקוח
  if (clientName) params.set('name', clientName);
  if (clientEmail) params.set('email', clientEmail);
  return `${CALENDLY_URL}?${params.toString()}`;
}

export const netWorthHistory = [
  { month: 'אפר', value: 109000 },
  { month: 'מאי', value: 115500 },
  { month: 'יוני', value: 121000 },
  { month: 'יולי', value: 129200 },
  { month: 'אוג', value: 138800 },
  { month: 'ספט', value: 149200 },
];

export const accounts = [
  {
    id: 1, type: 'checking', name: 'עו"ש בנק לאומי', balance: 18400,
    recentTransactions: [
      { desc: 'סופר יעד 2000', amount: -412, date: '2026-09-10' },
      { desc: 'משכורת', amount: 14500, date: '2026-09-01' },
      { desc: 'ארנונה', amount: -680, date: '2026-08-28' },
    ],
  },
  { id: 2, type: 'savings', name: 'חיסכון בנק הפועלים', balance: 42000, rate: 3.8, nextExitDate: '2026-11-01' },
  { id: 3, type: 'deposit', name: 'פיקדון שקלי 12 חודשים', balance: 60000, rate: 4.5, nextExitDate: '2027-02-15' },
];

export const liabilities = [
  {
    id: 1, type: 'mortgage', name: 'משכנתא', balance: 220000, monthlyPayment: 4200,
    tracks: [
      { name: 'מסלול ריבית קבועה לא צמודה', rate: 4.5, balance: 140000, lastPaymentDate: '2026-09-01' },
      { name: 'מסלול פריים', rate: 6.1, balance: 80000, lastPaymentDate: '2026-09-01' },
    ],
  },
  { id: 2, type: 'loan', name: 'הלוואה לרכב', balance: 38000, monthlyPayment: 1350, rate: 7.2, endDate: '2029-03-01' },
  {
    id: 3, type: 'credit', name: 'כאל בנקאי •6231', balance: 3200, monthlyPayment: null,
    creditLimit: 8000, utilized: 3200, upcomingChargeAmount: 1800, upcomingChargeDate: '2026-10-05',
    revolvingCredit: false, // ponytail: אם true צריך להתריע ללקוח - לא רלוונטי כרגע, להוסיף כשיהיה נתון אמיתי
  },
  {
    id: 4, type: 'credit', name: 'מקס חוץ בנקאי •5487', balance: 1500, monthlyPayment: null,
    creditLimit: 5000, utilized: 1500, upcomingChargeAmount: 900, upcomingChargeDate: '2026-10-08',
    revolvingCredit: false,
  },
  {
    id: 5, type: 'credit', name: 'ישראכרט חוץ בנקאי •9143', balance: 1500, monthlyPayment: null,
    creditLimit: 6000, utilized: 1500, upcomingChargeAmount: 700, upcomingChargeDate: '2026-10-10',
    revolvingCredit: false,
  },
];

// פרופיל המשתמש - יגיע מהאונבורדינג בעתיד, כרגע דמו
export const userProfile = { age: 32, salary: 14000 };

export const pensionFunds = [
  { id: 1, type: 'pension', name: 'קרן פנסיה מקיפה', provider: 'מגדל', balance: 210000, feeFromDeposit: 3.5, feeFromAccumulation: 0.9, investmentTrack: 'מסלול כללי - תלוי גיל (ברירת מחדל)', stockExposure: 45, isDefaultTrack: true, return12m: 8.2 },
  { id: 2, type: 'gemel', name: 'קופת גמל להשקעה', provider: 'הראל', balance: 45000, feeFromDeposit: 0, feeFromAccumulation: 0.7, investmentTrack: 'מסלול מנייתי', stockExposure: 80, isDefaultTrack: false, return12m: 12.4 },
  { id: 3, type: 'study', name: 'קרן השתלמות', provider: 'כלל', balance: 38000, feeFromDeposit: 1.2, feeFromAccumulation: 0.6, investmentTrack: 'מסלול מאוזן', stockExposure: 60, isDefaultTrack: false, return12m: 9.1 },
];

export const insurancePolicies = [
  {
    id: 1, type: 'life', name: 'ביטוח חיים', provider: 'הפניקס', coverage: 800000, monthlyPremium: 145,
    coverageItems: ['מוות מכל סיבה — 800,000 ₪', 'מחלות קשות (ריידר) — 150,000 ₪', 'פטור מתשלום פרמיה במקרה של אי כושר עבודה'],
  },
  {
    id: 2, type: 'disability', name: 'אובדן כושר עבודה', provider: 'מגדל מקפת', coverage: null, monthlyPremium: 180,
    coverageItems: ['פיצוי חודשי של 75% מהשכר המבוטח', 'תקופת המתנה: 90 יום', 'כיסוי עד גיל 67', 'החרפה — כיסוי גם באובדן כושר חלקי'],
  },
  // אין ביטוח בריאות פרטי - לדמו של פיצ'ר "זיהוי פערי כיסוי"
];

export function computeNetWorth() {
  const assetsTotal = accounts.reduce((s, a) => s + a.balance, 0)
    + pensionFunds.reduce((s, p) => s + p.balance, 0);
  const liabilitiesTotal = liabilities.reduce((s, l) => s + l.balance, 0);
  return { assetsTotal, liabilitiesTotal, netWorth: assetsTotal - liabilitiesTotal };
}
