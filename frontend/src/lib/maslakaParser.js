// פרסור קבצי XML של מסלקת הפנסיה הממשלתית ("מבנה אחיד להעברת מידע")
// port נאמן ל-Python parser (C:\Users\david\.claude\skills\masalka-har-bituach-parser\parsers.py)
// המקור: CRM_DAVIT_FIN/backend/parsers.py - כל ה"תפסי" (gotchas) שם מתועדים ומיושמים כאן.
import { normalizeIsraeliId } from './israeliId';

// STATUS-POLISA-O-CHESHBON: קודים מאומתים מול קבצים אמיתיים - 1=פעיל, 8=ריסק זמני (הכיסוי הביטוחי
// עדיין פעיל, רק ההפקדות מוקפאות), כל קוד אחר (למשל 2) = לא פעיל. אם יתגלה קוד נוסף שלא תואם,
// עדיף לבדוק מול קובץ אמיתי מאשר לנחש.
function policyStatusLabel(code) {
  if (code === '1') return 'פעיל';
  if (code === '8') return 'ריסק זמני';
  return 'לא פעיל';
}

function directChildText(el, tag) {
  for (const child of el.children) {
    if (child.tagName === tag) return (child.textContent || '').trim();
  }
  return '';
}

function directChild(el, tag) {
  for (const child of el.children) {
    if (child.tagName === tag) return child;
  }
  return null;
}

function allDescendants(el, tag) {
  return Array.from(el.getElementsByTagName(tag));
}

// מקביל ל-get_val של פייתון: מסתכל בכל הצאצאים (לא רק ילדים ישירים), מדלג על ריק/NULL/0
function getVal(root, tag) {
  for (const el of allDescendants(root, tag)) {
    const t = (el.textContent || '').trim();
    if (!t || t === 'NULL') continue;
    const f = parseFloat(t);
    if (!isNaN(f) && f === 0) continue;
    return t;
  }
  return '';
}

function fmtDate(d) {
  if (!d || d.length < 8) return d || '';
  return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function parseMaslakaDate(s) {
  if (/^\d{8}$/.test(s)) return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return null;
}

function formatDDMMYYYY(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${pad(d.getFullYear())}`;
}

// דמי ניהול לפי המבנה (MivneDmeiNihul) - עדיף על השדות השטוחים SHEUR-DMEI-NIHUL-* כשקיים
function mivneDmeiNihul(heshbon) {
  let dmhMivne = '', dmtMivne = '';
  for (const mdn of allDescendants(heshbon, 'MivneDmeiNihul')) {
    for (const perot of allDescendants(mdn, 'PerutMivneDmeiNihul')) {
      const sug = directChildText(perot, 'SUG-HOTZAA');
      const v = parseFloat(directChildText(perot, 'SHEUR-DMEI-NIHUL'));
      if (!isNaN(v) && v > 0) {
        if (sug === '1' && !dmtMivne) dmtMivne = v.toFixed(2);
        else if (sug === '2' && !dmhMivne) dmhMivne = v.toFixed(2);
      }
    }
  }
  return { dmhMivne, dmtMivne };
}

// יתרה נוכחית = סכום PerutYitrot (לא TOTAL-CHISACHON-MITZTABER-TZAFUY - זו תחזית לפרישה, לא יתרה נוכחית)
function sumYitrot(heshbon) {
  let tagmulim = 0, pitzuim = 0;
  for (const py of allDescendants(heshbon, 'PerutYitrot')) {
    const sug = directChildText(py, 'KOD-SUG-HAFRASHA');
    const amt = parseFloat(directChildText(py, 'TOTAL-CHISACHON-MTZBR')) || 0;
    if (sug === '2' || sug === '3') tagmulim += amt;
    else if (sug === '1') pitzuim += amt;
  }
  return { tagmulim, pitzuim };
}

// תפס אמיתי: נמצא בקובץ אמיתי אותו מסלול גיל כתוב פעם "לבני 50 ומטה" ופעם "לבני 05 ומטה" -
// טעות הקלדה של החברה במקור (היפוך ספרות), לא שלנו. בלי תיקון, אותו מסלול נספר כשני מסלולים
// שונים ועלול לגרום לבחירת "המסלול העיקרי" השגוי.
function fixTransposedAgeDigits(name) {
  const m = name.match(/^(.*לבני\s+)0(\d)(\s*(?:ומטה|ומעלה).*)$/);
  return m ? `${m[1]}${m[2]}0${m[3]}` : name;
}

function tracksFromMaslulim(heshbon) {
  const amounts = {};
  const kods = {};
  for (const node of allDescendants(heshbon, 'PerutMasluleiHashkaa')) {
    const name = fixTransposedAgeDigits(directChildText(node, 'SHEM-MASLUL-HASHKAA'));
    const amt = parseFloat(directChildText(node, 'SCHUM-TZVIRA-BAMASLUL')) || 0;
    if (name) {
      amounts[name] = (amounts[name] || 0) + amt;
      if (!kods[name]) kods[name] = directChildText(node, 'KOD-MASLUL-HASHKAA');
    }
  }
  const total = Object.values(amounts).reduce((a, b) => a + b, 0);
  if (total > 0) {
    return Object.entries(amounts).map(([name, amt]) => ({ name, pct: Math.round((amt / total) * 100), kod: kods[name] || '' }));
  }
  const old = directChildText(heshbon, 'SHEM-MASLUL-HABITUAH');
  return old ? [{ name: old, pct: null }] : [];
}

function extractPension(root, result) {
  const clientId = normalizeIsraeliId(getVal(root, 'MISPAR-ZIHUY-LAKOACH'));
  const lakoach = root.querySelector('YeshutLakoach');
  const fnameHe = lakoach ? directChildText(lakoach, 'SHEM-PRATI') : '';
  const lnameHe = lakoach ? directChildText(lakoach, 'SHEM-MISHPACHA') : '';
  const birth = getVal(root, 'TAARICH-LEYDA');

  if (!result.client && clientId) {
    result.client = { id: clientId, first: fnameHe, last: lnameHe, birth: fmtDate(birth) };
  }

  // חברה נקראת בתוך כל בלוק YeshutYatzran בנפרד - קובץ PNN יכול להכיל כמה קרנות מכמה חברות
  // שונות, כשכל YeshutYatzran עוטף את ה-Mutzar/HeshbonOPolisa השייכים לו (SHEM-YATZRAN הוא
  // אב-קדמון של Mutzar בעץ, לא צאצא שלו - אי אפשר לקרוא אותו מתוך ה-Mutzar עצמו).
  const yatzranim = allDescendants(root, 'YeshutYatzran');
  const groups = yatzranim.length
    ? yatzranim.map(y => ({ company: directChildText(y, 'SHEM-YATZRAN'), heshbonot: allDescendants(y, 'HeshbonOPolisa') }))
    : [{ company: getVal(root, 'SHEM-YATZRAN'), heshbonot: allDescendants(root, 'HeshbonOPolisa') }];

  for (const { company, heshbonot } of groups) {
  const list = heshbonot.length ? heshbonot : [root];
  for (const heshbon of list) {
    const policyNum = getVal(heshbon, 'MISPAR-POLISA-O-HESHBON');
    const joinDate = getVal(heshbon, 'TAARICH-HITZTARFUT-MUTZAR') || getVal(heshbon, 'TAARICH-HITZTARFUT-RISHON');
    const retAgeRaw = getVal(heshbon, 'GIL-PRISHA');
    const retAge = retAgeRaw ? String(Math.trunc(parseFloat(retAgeRaw))) : '';
    const monthlyPension = getVal(heshbon, 'KITZVAT-HODSHIT-TZFUYA');
    const netReturn = getVal(heshbon, 'SHEUR-TSUA-NETO');
    const nechonut = getVal(heshbon, 'TAARICH-NECHONUT');
    const returnYear = nechonut && nechonut.length >= 4 ? nechonut.slice(0, 4) : '';
    const plan = getVal(heshbon, 'SHEM-TOCHNIT');
    const status = getVal(heshbon, 'STATUS-POLISA-O-CHESHBON');
    const sugKeren = getVal(heshbon, 'SUG-KEREN-PENSIA');
    const pensionType = { '1': 'פנסיה ותיקה', '2': 'פנסיה מקיפה', '3': 'פנסיה משלימה כללית' }[sugKeren] || '';

    const { tagmulim, pitzuim } = sumYitrot(heshbon);
    const savingsVal = tagmulim + pitzuim;

    const { dmhMivne, dmtMivne } = mivneDmeiNihul(heshbon);
    const dmh = dmhMivne || getVal(heshbon, 'MEMOTZA-SHEUR-DMEI-NIHUL-HAFKADA') || getVal(heshbon, 'SHEUR-DMEI-NIHUL-HAFKADA');
    let dmtAnnual = dmtMivne || getVal(heshbon, 'SHEUR-DMEI-NIHUL-HISACHON');
    if (!dmtAnnual) {
      const v = parseFloat(getVal(heshbon, 'SHEUR-DMEI-NIHUL-TZVIRA'));
      if (!isNaN(v)) dmtAnnual = v >= 0.5 ? v.toFixed(2) : (v * 12).toFixed(2);
    }

    if (policyNum) {
      result.pension.push({
        policyNum, company, pensionType, plan,
        joinDate: fmtDate(joinDate), retAge,
        savings: savingsVal > 0 ? savingsVal.toFixed(2) : '',
        tagmulim: tagmulim ? String(Math.round(tagmulim)) : '',
        pitzuim: pitzuim ? String(Math.round(pitzuim)) : '',
        monthlyPension, netReturn, returnYear,
        tracks: tracksFromMaslulim(heshbon),
        dmeiNihulHafkada: dmh, dmeiNihulTzvira: dmtAnnual,
        status: policyStatusLabel(status),
      });
    }
  }
  }
}

function extractStudyFund(root, result) {
  const companyKgm = getVal(root, 'SHEM-YATZRAN');
  const SUG_LABELS = { '3': 'קרן השתלמות', '4': 'קופת גמל', '9': 'גמל להשקעה', '10': 'חיסכון לכל ילד' };

  for (const mutzar of allDescendants(root, 'Mutzar')) {
    const nm = directChild(mutzar, 'NetuneiMutzar');
    if (!nm) continue;
    const sugMutzar = getVal(nm, 'SUG-MUTZAR');
    if (!(sugMutzar in SUG_LABELS)) continue;

    for (const heshbon of allDescendants(mutzar, 'HeshbonOPolisa')) {
      const sfPnum = getVal(heshbon, 'MISPAR-POLISA-O-HESHBON') || '';
      const pstat = getVal(heshbon, 'STATUS-POLISA-O-CHESHBON');
      const net = getVal(heshbon, 'SHEUR-TSUA-NETO');
      const nechonut = getVal(heshbon, 'TAARICH-NECHONUT');
      const join = getVal(heshbon, 'TAARICH-HITZTARFUT-RISHON');
      const tochnit = getVal(heshbon, 'SHEM-TOCHNIT');

      const { dmhMivne: dnHMivne, dmtMivne: dnAnnualMivne } = mivneDmeiNihul(heshbon);
      let dnAnnual = dnAnnualMivne;
      if (!dnAnnual) {
        const dnT = getVal(heshbon, 'SHEUR-DMEI-NIHUL-HISACHON') || getVal(heshbon, 'SHEUR-DMEI-NIHUL-TZVIRA');
        const dnVal = parseFloat(dnT) || 0;
        dnAnnual = dnVal >= 0.5 ? dnVal.toFixed(2) : (dnVal ? (dnVal * 12).toFixed(2) : '');
      }
      const dnH = dnHMivne || getVal(heshbon, 'MEMOTZA-SHEUR-DMEI-NIHUL-HAFKADA') || getVal(heshbon, 'SHEUR-DMEI-NIHUL-HAFKADA');

      // oved/maavid רק לתצוגה - קודי הפרשה נוספים קיימים (למשל 12 = הפקדת מדינה ב"חיסכון לכל ילד")
      // שלא שייכים לאף צד, ולכן היתרה הכוללת נספרת מכל הקודים ולא רק משני האלה.
      let oved = 0, maavid = 0, allYitrot = 0;
      for (const py of allDescendants(heshbon, 'PerutYitrot')) {
        const sugH = directChildText(py, 'KOD-SUG-HAFRASHA');
        const amt = parseFloat(directChildText(py, 'TOTAL-CHISACHON-MTZBR')) || 0;
        allYitrot += amt;
        if (sugH === '1' || sugH === '8') oved += amt;
        else if (sugH === '2' || sugH === '9') maavid += amt;
      }
      let tzviraVal = allYitrot;
      let tzvira = tzviraVal > 0 ? String(round2(tzviraVal)) : (getVal(heshbon, 'TZVIRAT-CHISACHON-CHAZUYA-LELO-PREMIYOT') || '');
      tzviraVal = parseFloat(tzvira) || 0;

      const tracksK = tracksFromMaslulim(heshbon);
      const returnYear = nechonut && nechonut.length >= 4 ? nechonut.slice(0, 4) : '';

      let effectiveLabel;
      if (tochnit.includes('השתלמות')) effectiveLabel = 'קרן השתלמות';
      else if (tochnit.includes('גמל להשקעה')) effectiveLabel = 'גמל להשקעה';
      else if (['קופת גמל', 'קופג', 'קופ"ג'].some(k => tochnit.includes(k))) effectiveLabel = 'קופת גמל';
      else effectiveLabel = SUG_LABELS[sugMutzar] || 'קופת גמל';

      let liquidityDate = '', liquidityStatus = '';
      if (effectiveLabel === 'קרן השתלמות' && join) {
        const joinClean = join.length >= 8 ? join.slice(0, 8) : join;
        const jd = parseMaslakaDate(joinClean);
        if (jd) {
          const liq = new Date(jd);
          liq.setFullYear(jd.getFullYear() + 6);
          liquidityDate = formatDDMMYYYY(liq);
          liquidityStatus = liq <= new Date() ? 'נזיל' : 'לא נזיל';
        }
      }

      if (tzviraVal > 0) {
        result.study_fund.push({
          productType: effectiveLabel, company: companyKgm, plan: tochnit, policyNum: sfPnum,
          tzvira, oved: oved ? String(Math.round(oved)) : '', maavid: maavid ? String(Math.round(maavid)) : '',
          netReturn: net, returnYear, joinDate: fmtDate(join),
          liquidityDate, liquidityStatus,
          dmeiNihulTzvira: dnAnnual, dmeiNihulHafkada: dnH, tracks: tracksK,
          status: policyStatusLabel(pstat),
        });
      }
    }
  }
}

function extractInsurance(root, result) {
  const companyIng = getVal(root, 'SHEM-YATZRAN');
  const SUG_ING_LABELS = { '1': 'ביטוח מנהלים', '5': 'ביטוח מנהלים', '6': 'ביטוח חיים / ריסק', '7': 'בריאות', '8': 'ריסק', '10': 'תאונות אישיות' };

  // SUG-MUTZAR נקרא בתוך כל בלוק Mutzar בנפרד - קובץ ING אחד יכול לערבב פוליסת ביטוח מנהלים
  // אמיתית (עם צבירה) עם פוליסת ביטוח חיים רגילה ללא צבירה, וזה לא אותו סוג מוצר (אותו תיקון
  // שכבר קיים ב-extractPension/extractStudyFund - קריאה גלובלית פעם אחת מיישמת שגוי את הסוג
  // הראשון שנמצא על כל הפוליסות בקובץ).
  const mutzarim = allDescendants(root, 'Mutzar');
  const groups = mutzarim.length
    ? mutzarim.map(m => ({ mutzar: m, sugRoot: getVal(m, 'SUG-MUTZAR') }))
    : [{ mutzar: root, sugRoot: getVal(root, 'SUG-MUTZAR') }];

  for (const { mutzar, sugRoot } of groups) {
  const rootLabel = SUG_ING_LABELS[sugRoot] || 'ביטוח';
  const isManagers = sugRoot === '1' || sugRoot === '5';

  for (const heshbon of allDescendants(mutzar, 'HeshbonOPolisa')) {
    const pnum = directChildText(heshbon, 'MISPAR-POLISA-O-HESHBON');
    const tochnit = directChildText(heshbon, 'SHEM-TOCHNIT');
    const pstat = directChildText(heshbon, 'STATUS-POLISA-O-CHESHBON');
    const join = directChildText(heshbon, 'TAARICH-HITZTARFUT-RISHON') || directChildText(heshbon, 'TAARICH-HITZTARFUT-MUTZAR');
    const prem = directChildText(heshbon, 'PREMYA-HODSHIT') || directChildText(heshbon, 'PREMYA-SHNATI')
      || getVal(heshbon, 'TOTAL-HAFKADA') || getVal(root, 'TOTAL-HAFKADA') || getVal(root, 'SCHUM-HAFRASHA') || '';
    if (!pnum) continue;
    const status = policyStatusLabel(pstat);
    const isActive = status !== 'לא פעיל'; // ריסק זמני - הכיסוי עדיין פעיל, רק ההפקדות מוקפאות
    const entry = {
      policyNum: pnum, company: companyIng, plan: tochnit || rootLabel, type: rootLabel,
      status, joinDate: fmtDate(join), premium: isActive ? prem : '',
    };

    if (isManagers) {
      const tracks = tracksFromMaslulim(heshbon);
      let tzviraTotal = 0;
      for (const maslul of allDescendants(heshbon, 'PerutMasluleiHashkaa')) {
        const amt = parseFloat(getVal(maslul, 'SCHUM-TZVIRA-BAMASLUL'));
        if (!isNaN(amt)) tzviraTotal += amt;
      }
      if (!tzviraTotal) {
        const fb = getVal(heshbon, 'SCHUM-NECHONUT') || getVal(heshbon, 'YITRAT-ZCHUYOT') || '';
        tzviraTotal = parseFloat(fb) || 0;
      }
      entry.tzvira = tzviraTotal ? String(Math.round(tzviraTotal)) : '';
      // מסלול ההשקעה העיקרי (הכי גדול בצבירה) - כולל הקוד המספרי (KOD-MASLUL-HASHKAA) שממנו
      // אפשר לחלץ FUND_ID מדויק מול data.gov.il, בדיוק כמו בפנסיה/גמל.
      const mainTrack = tracks.length ? tracks.reduce((a, b) => (b.pct || 0) > (a.pct || 0) ? b : a) : null;
      entry.track = mainTrack?.name || '';
      entry.trackCode = mainTrack?.kod || '';

      let dmTzvira = '', dmHafkada = '';
      for (const mivne of allDescendants(heshbon, 'PerutMivneDmeiNihul')) {
        const sug = directChildText(mivne, 'SUG-HOTZAA');
        const rateF = parseFloat(directChildText(mivne, 'SHEUR-DMEI-NIHUL'));
        if (isNaN(rateF)) continue;
        if (sug === '1' && rateF > 0 && !dmTzvira) dmTzvira = String(rateF);
        else if (sug === '2' && rateF > 0 && !dmHafkada) dmHafkada = String(rateF);
      }
      entry.dmeiNihulTzvira = dmTzvira;
      entry.dmeiNihulHafkada = dmHafkada || getVal(heshbon, 'SHEUR-DMEI-NIHUL-HAFKADA') || getVal(heshbon, 'MEMOTZA-SHEUR-DMEI-NIHUL-HAFKADA') || '';
      entry.netReturn = getVal(heshbon, 'SHEUR-TSUA-NETO') || '';

      let akeMonthly = '', akePremium = '', riskAmount = '';
      for (const kisuy of allDescendants(heshbon, 'PirteiKisuiBeMutzar')) {
        const sugK = directChildText(kisuy, 'SUG-KISUY-BITOCHI');
        if (sugK === '5') {
          akeMonthly = directChildText(kisuy, 'SCHUM-BITUACH');
          akePremium = directChildText(kisuy, 'DMEI-BITUAH-LETASHLUM-BAPOAL');
        } else if (sugK === '8') {
          const rawRisk = directChildText(kisuy, 'SCHUM-BITUAH-LEMAVET') || directChildText(kisuy, 'SCHUM-BITUACH');
          const rv = parseFloat(rawRisk);
          riskAmount = (!isNaN(rv) && rv > 0) ? String(Math.round(rv)) : '';
        }
      }
      entry.akeMonthly = akeMonthly;
      entry.akePremium = akePremium;
      entry.riskAmount = riskAmount;
      result.managers_insurance.push(entry);
    } else {
      let sumInsured = '';
      for (const yesodi of allDescendants(heshbon, 'SchumeiBituahYesodi')) {
        const v = directChildText(yesodi, 'SCHUM-BITUAH-LEMAVET');
        const f = parseFloat(v);
        if (v && !isNaN(f)) { sumInsured = String(Math.round(f)); break; }
      }
      if (!sumInsured) {
        for (const kisuy of allDescendants(heshbon, 'PirteiKisuiBeMutzar')) {
          const v = directChildText(kisuy, 'SCHUM-BITUACH') || directChildText(kisuy, 'SCHUM-BITUAH-LEMAVET');
          const f = parseFloat(v);
          if (!isNaN(f) && f > 0) { sumInsured = String(Math.round(f)); break; }
        }
      }

      let pledgedTo = '';
      outer: for (const nameTag of ['SHEM-MISHPACHA-MUTAV', 'SHEM-PRATI-MUTAV']) {
        for (const elem of allDescendants(heshbon, nameTag)) {
          const parent = elem.parentElement;
          if (parent && directChildText(parent, 'SUG-ZIKA') === '9') {
            pledgedTo = (elem.textContent || '').trim();
            if (pledgedTo) break outer;
          }
        }
      }

      entry.sumInsured = sumInsured;
      entry.pledgedTo = pledgedTo;
      result.insurance.push(entry);
    }
  }
  }
}

// מפרסר קובץ XML בודד ומוסיף את התוצאה ל-result המשותף (מזהה סוג לפי שם הקובץ)
export function parseMaslakaXmlFile(xmlText, fileName, result) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error(`קובץ XML לא תקין: ${fileName}`);

  const upper = fileName.toUpperCase();
  const root = doc.documentElement;

  if (upper.includes('PNN')) extractPension(root, result);
  else if (upper.includes('KGM')) extractStudyFund(root, result);
  else if (['ING', 'INK', 'INP', 'INM'].some(x => upper.includes(x))) extractInsurance(root, result);
  else throw new Error(`לא זוהה סוג הקובץ (לא PNN/KGM/ING/INK/INP/INM): ${fileName}`);
}

// מפרסר כמה קבצי XML של מסלקה בבת אחת -> { pension, study_fund, insurance, managers_insurance, client }
export function parseMaslakaFiles(files) {
  const result = { pension: [], study_fund: [], insurance: [], managers_insurance: [], client: null };
  for (const { text: xmlText, name } of files) {
    parseMaslakaXmlFile(xmlText, name, result);
  }
  return result;
}
