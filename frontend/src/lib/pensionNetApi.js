// חיבור לדאטהסטים הפתוחים של data.gov.il - פנסיה נט וגמל נט
// ponytail: fetch ישיר מהדפדפן (CORS פתוח, נבדק ועובד), התאמה לפי שם חברה בלבד - לא לפי קרן ספציפית

const PENSION_NET_RESOURCE = '6d47d6b5-cb08-488b-b333-f1e717b1e1bd';
const GEMEL_NET_RESOURCE = 'a30dcbea-a1d2-482c-ae29-8f781f5025fb';

async function fetchLatestFundRecord(resourceId, companyName) {
  const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&q=${encodeURIComponent(companyName)}&limit=1&sort=REPORT_PERIOD desc`;
  const res = await fetch(url);
  const data = await res.json();
  return data.result.records[0] ?? null;
}

export async function fetchRealFundData(providerName, fundType) {
  const resourceId = fundType === 'pension' ? PENSION_NET_RESOURCE : GEMEL_NET_RESOURCE;
  const record = await fetchLatestFundRecord(resourceId, providerName);
  if (!record) return null;
  return {
    fundName: record.FUND_NAME,
    stockExposurePercent: record.TOTAL_ASSETS ? Math.round((record.STOCK_MARKET_EXPOSURE / record.TOTAL_ASSETS) * 100) : null,
    yieldTrailing3Yrs: record.YIELD_TRAILING_3_YRS,
    yieldTrailing5Yrs: record.YIELD_TRAILING_5_YRS,
    reportPeriod: record.REPORT_PERIOD,
  };
}
