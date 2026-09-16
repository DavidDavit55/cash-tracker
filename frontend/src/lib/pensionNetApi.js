// חיבור לדאטהסטים הפתוחים של data.gov.il - פנסיה נט וגמל נט
// ponytail: fetch ישיר מהדפדפן (CORS פתוח, נבדק ועובד)

const PENSION_NET_RESOURCE = '6d47d6b5-cb08-488b-b333-f1e717b1e1bd';
const GEMEL_NET_RESOURCE = 'a30dcbea-a1d2-482c-ae29-8f781f5025fb';

// KOD-MASLUL-HASHKAA במסלקה מקודד בתוכו את ה-FUND_ID של הדאטהסט הממשלתי: 9 הספרות הראשונות
// הן MANAGING_CORPORATION_LEGAL_ID, וה-FUND_ID עצמו הוא הסיומת (לא כל מה שנשאר אחרי הקידומת -
// יש ביניהם ספרות נוספות שאינן חלק מה-FUND_ID, ואורך ה-FUND_ID משתנה בין 4-6 ספרות). לכן בודקים
// כמה אורכי סיומת אפשריים ומאמתים כל אחד מול ה-DB לפי FUND_ID + התאמת ה-legal id.
function kodParts(kod) {
  const digits = String(kod || '').replace(/\D/g, '');
  if (digits.length <= 9) return null;
  const legalId = digits.slice(0, 9);
  const suffixLens = [4, 5, 6, 3];
  const fundIdCandidates = [...new Set(
    suffixLens
      .filter(len => len < digits.length - 9)
      .map(len => parseInt(digits.slice(-len), 10))
      .filter(n => !isNaN(n))
  )];
  return { legalId, fundIdCandidates };
}

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

export async function fetchRealFundData(providerName, fundType, trackName, planName, trackCode) {
  const resourceId = fundType === 'pension' ? PENSION_NET_RESOURCE : GEMEL_NET_RESOURCE;

  // התאמה מדויקת: אם יש לנו FUND_ID שחולץ מ-KOD-MASLUL-HASHKAA, מחפשים ישירות לפי מזהה
  // ואין צורך בניחוש לפי שם בכלל. מאמתים מול ה-legal id כדי לפסול התאמות מקריות.
  const parts = kodParts(trackCode);
  if (parts) {
    for (const fundId of parts.fundIdCandidates) {
      const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&filters=${encodeURIComponent(JSON.stringify({ FUND_ID: fundId }))}&sort=REPORT_PERIOD desc&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      const record = data.result.records?.[0];
      if (record && String(record.MANAGING_CORPORATION_LEGAL_ID) === parts.legalId) return toFundData(record, true);
    }
  }

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
  return toFundData(record);
}

function toFundData(record, exactMatch = false) {
  return {
    fundName: record.FUND_NAME,
    stockExposurePercent: record.TOTAL_ASSETS ? Math.round((record.STOCK_MARKET_EXPOSURE / record.TOTAL_ASSETS) * 100) : null,
    yieldTrailing3Yrs: record.YIELD_TRAILING_3_YRS,
    yieldTrailing5Yrs: record.YIELD_TRAILING_5_YRS,
    reportPeriod: record.REPORT_PERIOD,
    exactMatch,
  };
}
