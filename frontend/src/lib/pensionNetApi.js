// חיבור לדאטהסטים הפתוחים של data.gov.il - פנסיה נט וגמל נט
// ponytail: fetch ישיר מהדפדפן (CORS פתוח, נבדק ועובד)

const PENSION_NET_RESOURCE = '6d47d6b5-cb08-488b-b333-f1e717b1e1bd';
const GEMEL_NET_RESOURCE = 'a30dcbea-a1d2-482c-ae29-8f781f5025fb';

// אין קוד מסלול משותף בין המסלקה לדאטהסט הממשלתי - FUND_ID/FUND_NAME הם המזהה של הדאטהסט,
// ואין להם מקבילה ב-XML של המסלקה. ההתאמה המדויקת ביותר האפשרית: לחפש בין כל הקרנות של אותה
// חברה את זו ששם המסלול שלה (FUND_NAME) הכי חופף לשם המסלול שדווח במסלקה, במקום סתם לקחת
// את התוצאה הראשונה שחוזרת לפי שם חברה בלבד.
function normalize(s) {
  return String(s || '').replace(/["'.]/g, '').replace(/\s+/g, ' ').trim();
}

function trackMatchScore(fundName, trackName) {
  const a = normalize(fundName);
  const b = normalize(trackName);
  if (!a || !b) return 0;
  const aWords = new Set(a.split(' '));
  const bWords = b.split(' ');
  return bWords.filter(w => aWords.has(w)).length;
}

async function fetchCandidateRecords(resourceId, companyName) {
  const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&q=${encodeURIComponent(companyName)}&limit=100&sort=REPORT_PERIOD desc`;
  const res = await fetch(url);
  const data = await res.json();
  return data.result.records || [];
}

export async function fetchRealFundData(providerName, fundType, trackName, planName) {
  const resourceId = fundType === 'pension' ? PENSION_NET_RESOURCE : GEMEL_NET_RESOURCE;
  const records = await fetchCandidateRecords(resourceId, providerName);
  if (!records.length) return null;

  // הקרן העדכנית ביותר (REPORT_PERIOD גבוה) לכל FUND_ID, כדי לא לבחור דיווח ישן של אותו מסלול.
  const latestByFund = new Map();
  for (const r of records) {
    const existing = latestByFund.get(r.FUND_ID);
    if (!existing || r.REPORT_PERIOD > existing.REPORT_PERIOD) latestByFund.set(r.FUND_ID, r);
  }
  const candidates = [...latestByFund.values()];

  // שם המסלול לבדו לא מספיק - "מקיפה"/"כללית" יכולים לחלוק בדיוק אותו שם מסלול גיל
  // ("לבני 50 ומטה"), אז מצרפים גם את שם התוכנית (plan) כדי להבדיל ביניהם.
  const searchText = [planName, trackName].filter(Boolean).join(' ');
  let record = candidates[0];
  if (searchText) {
    const scored = candidates
      .map(r => ({ r, score: trackMatchScore(r.FUND_NAME, searchText) }))
      .sort((a, b) => b.score - a.score);
    if (scored[0]?.score > 0) record = scored[0].r;
  }
  if (!record) return null;

  return {
    fundName: record.FUND_NAME,
    stockExposurePercent: record.TOTAL_ASSETS ? Math.round((record.STOCK_MARKET_EXPOSURE / record.TOTAL_ASSETS) * 100) : null,
    yieldTrailing3Yrs: record.YIELD_TRAILING_3_YRS,
    yieldTrailing5Yrs: record.YIELD_TRAILING_5_YRS,
    reportPeriod: record.REPORT_PERIOD,
  };
}
