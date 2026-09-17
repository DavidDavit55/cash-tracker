// השוואת תשואת הלקוח מול ממוצע השוק באותו מסלול (12 חודשים אחרונים), על בסיס data.gov.il.
// ponytail: עדיין לא מחובר לשום עמוד - מודול עצמאי שנבדק בנפרד לפני חיבור לאפליקציה.
//
// שיטת החישוב אומתה ידנית מול mygemel.net (התאמה מדויקת ב-100% בכל החברות שנבדקו):
// לוקחים 12 תשואות חודשיות אחרונות (MONTHLY_YIELD) ומצרפים אותן (compounding), לא ממוצע פשוט.
const PENSION_NET_RESOURCE = '6d47d6b5-cb08-488b-b333-f1e717b1e1bd';

// תשע חברות "פנסיה מקיפה" הגדולות - PARENT_COMPANY_NAME בדאטהסט הממשלתי (לא שם החברה הרגיל,
// יש לזה ניסוח משלו שאומת ידנית מול הדאטהסט לכל חברה).
const MAJOR_PENSION_COMPANIES = [
  'מיטב פנסיה מקיפה', 'הפניקס פנסיה מקיפה', 'אינפיניטי פנסיה מקיפה', 'מור פנסיה מקיפה',
  'אלטשולר שחם פנסיה מקיפה', 'מנורה מבטחים פנסיה', 'כלל פנסיה', 'הראל  פנסיה', 'מגדל מקפת אישית',
];

// תפס אמיתי שנתפס תוך כדי בדיקה ידנית: לא כל החברות קוראות למסלול הגיל באותו שם - רוב
// החברות אומרות "לבני X ומטה", אבל הראל אומרת "גילאי X ומטה". בלי הטיפול הזה הראל נעלמת
// בשקט מהממוצע בלי אף שגיאה.
function classifyTrack(fundName) {
  const ageMatch = fundName.match(/(?:לבני|גילאי)\s*(\d{2})\s*ומטה/);
  if (ageMatch) return `age_${ageMatch[1]}_under`;
  if (/s[1&]?[;&]?p\s*500/i.test(fundName)) return 'sp500';
  if (/הלכ/.test(fundName) && !/קצבה/.test(fundName)) return 'halachic';
  if (/מניות/.test(fundName) && !/(סחיר|עוקב|הלכ)/.test(fundName)) return 'equity';
  return null;
}

async function fetchCompanyRecords(company) {
  const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${PENSION_NET_RESOURCE}&filters=${encodeURIComponent(JSON.stringify({ PARENT_COMPANY_NAME: company }))}&limit=1000&sort=REPORT_PERIOD desc`;
  const res = await fetch(url);
  const data = await res.json();
  return data.result.records || [];
}

async function fetchFundHistory(fundId) {
  const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${PENSION_NET_RESOURCE}&filters=${encodeURIComponent(JSON.stringify({ FUND_ID: fundId }))}&limit=13&sort=REPORT_PERIOD desc`;
  const res = await fetch(url);
  const data = await res.json();
  return data.result.records.sort((a, b) => b.REPORT_PERIOD - a.REPORT_PERIOD);
}

function ltmFromHistory(records) {
  const last12 = records.slice(0, 12);
  if (last12.length < 12) return null;
  const compounded = last12.reduce((acc, r) => acc * (1 + (r.MONTHLY_YIELD || 0) / 100), 1);
  return (compounded - 1) * 100;
}

// תשואת 12 חודשים של הקרן המדויקת של הלקוח עצמה (לא ממוצע, כדי להשוות "אתה" מול "השוק").
export async function fetchOwnLTM(fundId) {
  const history = await fetchFundHistory(fundId);
  return ltmFromHistory(history);
}

// clientFundName: שם הקרן המדויקת של הלקוח (מ-fetchRealFundData, record.FUND_NAME) - ממנו
// מזהים את קטגוריית המסלול ומחפשים את אותה קטגוריה אצל שאר החברות הגדולות.
async function fetchCompanyLTM(company, category) {
  const records = await fetchCompanyRecords(company);
  if (!records.length) return null;
  const latestPeriod = Math.max(...records.map(r => r.REPORT_PERIOD));
  const match = records.find(r => r.REPORT_PERIOD === latestPeriod && classifyTrack(r.FUND_NAME) === category);
  if (!match) return null;
  const history = await fetchFundHistory(match.FUND_ID);
  const ltm = ltmFromHistory(history);
  return ltm != null ? { company, fundName: match.FUND_NAME, ltm } : null;
}

export async function fetchCategoryAverage(clientFundName) {
  const category = classifyTrack(clientFundName);
  if (!category) return null;

  // 9 חברות במקביל במקום ברצף - זה מה שגרם לכרטיס להיות איטי (עד 18 קריאות רשת אחת אחרי השנייה).
  const results = await Promise.all(MAJOR_PENSION_COMPANIES.map(company => fetchCompanyLTM(company, category)));
  const byCompany = results.filter(Boolean);

  if (!byCompany.length) return null;
  const average = byCompany.reduce((s, r) => s + r.ltm, 0) / byCompany.length;
  return { category, average, byCompany };
}
