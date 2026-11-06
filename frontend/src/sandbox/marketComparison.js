// השוואת תשואת הלקוח מול ממוצע השוק באותו מסלול (12 חודשים אחרונים), על בסיס data.gov.il.
// ponytail: עדיין לא מחובר לשום עמוד - מודול עצמאי שנבדק בנפרד לפני חיבור לאפליקציה.
//
// שיטת החישוב אומתה ידנית מול mygemel.net (התאמה מדויקת ב-100% בכל החברות שנבדקו):
// לוקחים 12 תשואות חודשיות אחרונות (MONTHLY_YIELD) ומצרפים אותן (compounding), לא ממוצע פשוט.
const PENSION_NET_RESOURCE = '6d47d6b5-cb08-488b-b333-f1e717b1e1bd';
const GEMEL_NET_RESOURCE = 'a30dcbea-a1d2-482c-ae29-8f781f5025fb';

// תשע חברות "פנסיה מקיפה" הגדולות - PARENT_COMPANY_NAME בדאטהסט הממשלתי (לא שם החברה הרגיל,
// יש לזה ניסוח משלו שאומת ידנית מול הדאטהסט לכל חברה).
const MAJOR_PENSION_COMPANIES = [
  'מיטב פנסיה מקיפה', 'הפניקס פנסיה מקיפה', 'אינפיניטי פנסיה מקיפה', 'מור פנסיה מקיפה',
  'אלטשולר שחם פנסיה מקיפה', 'מנורה מבטחים פנסיה', 'כלל פנסיה', 'הראל  פנסיה', 'מגדל מקפת אישית',
];

// אותן 9 חברות בדאטהסט הגמל - שדה שונה (MANAGING_CORPORATION, לא PARENT_COMPANY_NAME) וניסוח שונה,
// אומת ידנית מול הדאטהסט לכל חברה (17/9/2026).
const MAJOR_GEMEL_COMPANIES = [
  'מיטב גמל ופנסיה בע"מ', 'הפניקס פנסיה וגמל בע"מ', 'אינפיניטי השתלמות, גמל ופנסיה בע"מ',
  'מור גמל ופנסיה בע"מ', 'אלטשולר שחם גמל ופנסיה בע"מ', 'מנורה מבטחים פנסיה וגמל בע"מ',
  'כלל פנסיה וגמל בע"מ', 'הראל פנסיה וגמל בע"מ', 'מגדל מקפת קרנות פנסיה וקופות גמל בע"מ',
];

// productType (maslakaCards.js) -> FUND_CLASSIFICATION בדאטהסט הגמל - בלי זה אפשר בטעות להשוות
// "גמל להשקעה" מול "קרן השתלמות" רק כי שניהם באותו מסלול השקעה (למשל שניהם עוקבי S&P 500).
const GEMEL_CLASSIFICATION_BY_PRODUCT_TYPE = {
  'גמל להשקעה': 'קופת גמל להשקעה',
  'קופת גמל': 'תגמולים ואישית לפיצויים',
  'קרן השתלמות': 'קרנות השתלמות',
};

// תפס אמיתי שנתפס תוך כדי בדיקה ידנית: לא כל החברות קוראות למסלול הגיל באותו שם - רוב
// החברות אומרות "לבני X ומטה", אבל הראל אומרת "גילאי X ומטה". בלי הטיפול הזה הראל נעלמת
// בשקט מהממוצע בלי אף שגיאה.
export function classifyTrack(fundName) {
  const target = fundName.match(/(?:יעד\s*(?:לפרישה|פרישה)\s*(20\d{2})|(20\d{2})\s*יעד\s*(?:לפרישה|פרישה))/);
  if (target) return `target_${target[1] || target[2]}`;
  const ageMatch = fundName.match(/(?:לבני|גילאי)\s*(\d{2})\s*ומטה/);
  if (ageMatch) return `age_${ageMatch[1]}_under`;
  if (/(?:לבני|גילאי)\s*50\s*(?:עד|[-–])\s*60/.test(fundName)) return 'age_50_60';
  if (/(?:לבני|גילאי)\s*60\s*ומעלה/.test(fundName)) return 'age_60_over';
  if (/(?:^|\s)כללי(?:ת)?(?:\s|$)/.test(fundName) && !/(מניות|אג.?ח|עוקב|מקבלי)/.test(fundName)) return 'general';
  if (/s[1&]?[;&]?p\s*500/i.test(fundName)) return 'sp500';
  if (/הלכ/.test(fundName) && !/קצבה/.test(fundName)) return 'halachic';
  if (/מניות/.test(fundName) && !/(סחיר|עוקב|הלכ)/.test(fundName)) return 'equity';
  return null;
}

// resourceId/companyField/companies/extraFilters נבחרים לפי fundType ('pension' | 'gemel') -
// שני הדאטהסטים חולקים מבנה (REPORT_PERIOD/MONTHLY_YIELD/FUND_ID/FUND_NAME) אבל שדה שם החברה
// ורשימת החברות שונים (ראה MAJOR_GEMEL_COMPANIES למעלה).
function resourceConfig(fundType) {
  return fundType === 'gemel'
    ? { resourceId: GEMEL_NET_RESOURCE, companyField: 'MANAGING_CORPORATION', companies: MAJOR_GEMEL_COMPANIES }
    : { resourceId: PENSION_NET_RESOURCE, companyField: 'PARENT_COMPANY_NAME', companies: MAJOR_PENSION_COMPANIES };
}

// Share in-flight requests across periods and cards; expire public data after five minutes.
const responseCache = new Map();
function fetchRecords(url) {
  const cached = responseCache.get(url);
  if (cached && Date.now() - cached.created < 300000) return cached.promise;
  const promise = fetch(url, { signal: AbortSignal.timeout(25000) }).then(async response => {
    if (!response.ok) throw new Error('Market data unavailable');
    const data = await response.json();
    if (!Array.isArray(data.result?.records)) throw new Error('Invalid market data');
    return data.result.records;
  });
  responseCache.set(url, { promise, created: Date.now() });
  promise.catch(() => { if (responseCache.get(url)?.promise === promise) responseCache.delete(url); });
  return promise;
}

async function fetchCompanyRecords(resourceId, companyField, company, extraFilters) {
  const filters = { [companyField]: company, ...extraFilters };
  const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&filters=${encodeURIComponent(JSON.stringify(filters))}&limit=1000&sort=REPORT_PERIOD desc`;
  return fetchRecords(url);
}

async function fetchFundHistory(resourceId, fundId) {
  const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&filters=${encodeURIComponent(JSON.stringify({ FUND_ID: fundId }))}&limit=72&sort=REPORT_PERIOD desc`;
  return [...await fetchRecords(url)].sort((a, b) => b.REPORT_PERIOD - a.REPORT_PERIOD);
}

export function ltmFromHistory(records, endPeriod, months = 12) {
  if (![12, 36, 60].includes(months)) return null;
  const end = String(endPeriod);
  if (!/^\d{6}$/.test(end) || +end.slice(4) < 1 || +end.slice(4) > 12) return null;
  // The public dataset may retain fewer than 60 monthly rows, while publishing
  // official cumulative 3/5-year returns in the selected reporting month's row.
  const latest = records.filter(row => String(row.REPORT_PERIOD) === end);
  if (latest.length !== 1) return null;
  const field = months === 36 ? 'YIELD_TRAILING_3_YRS' : months === 60 ? 'YIELD_TRAILING_5_YRS' : null;
  const reported = field ? latest[0][field] : null;
  if (reported != null && String(reported).trim() !== '' && Number.isFinite(Number(reported))) return Number(reported);
  let product = 1;
  for (let offset = 0; offset < months; offset++) {
    const date = new Date(+end.slice(0, 4), +end.slice(4) - 1 - offset, 1);
    const key = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const matches = records.filter(row => String(row.REPORT_PERIOD) === key);
    if (matches.length !== 1) return null;
    const value = matches[0].MONTHLY_YIELD;
    if (value == null || String(value).trim() === '' || !Number.isFinite(Number(value))) return null;
    product *= 1 + Number(value) / 100;
  }
  return (product - 1) * 100;
}

// תשואת 12 חודשים של הקרן המדויקת של הלקוח עצמה (לא ממוצע, כדי להשוות "אתה" מול "השוק").
export async function fetchOwnLTM(fundId, fundType = 'pension', endPeriod, months = 12) {
  const { resourceId } = resourceConfig(fundType);
  const history = await fetchFundHistory(resourceId, fundId);
  return ltmFromHistory(history, endPeriod, months);
}

// clientFundName: שם הקרן המדויקת של הלקוח (מ-fetchRealFundData, record.FUND_NAME) - ממנו
// מזהים את קטגוריית המסלול ומחפשים את אותה קטגוריה אצל שאר החברות הגדולות.
async function fetchCompanyLTM(resourceId, companyField, company, category, extraFilters, endPeriod, months) {
  const records = await fetchCompanyRecords(resourceId, companyField, company, extraFilters);
  if (!records.length) return null;
  const latestPeriod = Number(endPeriod);
  const match = records.find(r => Number(r.REPORT_PERIOD) === latestPeriod && classifyTrack(r.FUND_NAME) === category);
  if (!match) return null;
  const history = await fetchFundHistory(resourceId, match.FUND_ID);
  const ltm = ltmFromHistory(history, endPeriod, months);
  return ltm != null ? { company, fundName: match.FUND_NAME, ltm } : null;
}

// fundType: 'pension' (ברירת מחדל) | 'gemel'. productType (רק לגמל): 'גמל להשקעה'/'קופת גמל'/
// 'קרן השתלמות' - כדי לא להשוות מסלול השקעה זהה משתי קטגוריות רגולטוריות שונות (למשל גמל
// להשקעה עוקב S&P500 מול קרן השתלמות עוקבת S&P500 - לא אותו מוצר, דמי ניהול/נזילות שונים).
export async function fetchCategoryAverage(clientFundName, fundType = 'pension', productType = null, endPeriod, months = 12) {
  if (fundType === 'gemel' && !GEMEL_CLASSIFICATION_BY_PRODUCT_TYPE[productType]) return null;
  const category = classifyTrack(clientFundName);
  if (!category) return null;

  const { resourceId, companyField, companies } = resourceConfig(fundType);
  const extraFilters = fundType === 'gemel' && GEMEL_CLASSIFICATION_BY_PRODUCT_TYPE[productType]
    ? { FUND_CLASSIFICATION: GEMEL_CLASSIFICATION_BY_PRODUCT_TYPE[productType] }
    : undefined;

  // 9 חברות במקביל במקום ברצף - זה מה שגרם לכרטיס להיות איטי (עד 18 קריאות רשת אחת אחרי השנייה).
  const results = await Promise.all(companies.map(company => fetchCompanyLTM(resourceId, companyField, company, category, extraFilters, endPeriod, months)));
  const byCompany = results.filter(Boolean);

  if (byCompany.length < 2) return null;
  const average = byCompany.reduce((s, r) => s + r.ltm, 0) / byCompany.length;
  return { category, average, byCompany, endPeriod };
}
