// מבנה דמה של הדשבורד - צורת הנתונים תואמת למה שיוחזר בעתיד מ-API/Supabase
// כדי לחבר לנתונים אמיתיים: להחליף כל export כאן בקריאת fetch/query ששומרת על אותה צורה

export const netWorthData = {
  current: 482500,
  changeAmount: 12400,
  changePercent: 2.6,
  changePeriodLabel: 'מתחילת החודש',
  assets: 610000,
  liabilities: 127500,
};

export const leaks = [
  {
    id: 1,
    title: 'כפילות בביטוח תאונות אישיות',
    detail: 'פוטנציאל חיסכון: ₪140 / חודש',
    detailColor: 'success',
    ctaLabel: 'טפל כעת',
    ctaType: 'action',
  },
  {
    id: 2,
    title: 'עמלת עו"ש עלתה ב-18%',
    detail: 'השפעה שנתית: ₪420',
    detailColor: 'muted',
    ctaLabel: 'לפרטים',
    ctaType: 'link',
  },
];

export const cashflowForecast = {
  monthLabel: 'ספטמבר',
  expectedIncome: 24500,
  expectedExpenses: 18200,
};

export const connectedAccounts = [
  { id: 1, name: 'בנק הפועלים', balance: 18450, status: 'connected' },
  { id: 2, name: 'כאל / MAX', balance: -6200, status: 'connected' },
];
