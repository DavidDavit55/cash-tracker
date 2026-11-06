import { accountProvider } from './accountProvider';
import { accountEmployers } from './accountEmployers';
import { survivorSalaryRate } from './survivorRate';
import { readDepositHistory } from './depositHistory';

// Sandbox-only enrichment using the date fields already read by maslakaParser.
// Do not substitute upload time for the product's reporting date.
export function enrichProductDates(cards, entries) {
  const accounts = entries.flatMap(entry => [...new DOMParser().parseFromString(entry.text, 'application/xml').getElementsByTagName('HeshbonOPolisa')]);
  const read = (node, tag) => [...node.getElementsByTagName(tag)].map(el => el.textContent.trim()).find(value => value && value !== 'NULL' && value !== '0');
  const date = value => {
    if (!/^\d{8}$/.test(value || '')) return null;
    const year = Number(value.slice(0, 4)), month = Number(value.slice(4, 6)), day = Number(value.slice(6, 8));
    const parsed = new Date(year, month - 1, day);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
    return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}`;
  };
  return cards.map(card => {
    const byNumber = accounts.filter(node => read(node, 'MISPAR-POLISA-O-HESHBON') === String(card.id));
    const matches = byNumber.length > 1 ? byNumber.filter(node => accountProvider(node) === card.provider) : byNumber;
    if (matches.length !== 1) return card;
    const node = matches[0];
    const coverageNodes = [...node.getElementsByTagName('KisuiBKerenPensia')];
    const coverage = coverageNodes.length === 1 ? coverageNodes[0] : null;
    const amount = tag => {
      const text = coverage && [...coverage.children].find(child => child.localName === tag)?.textContent.trim();
      return text && text !== 'NULL' && Number.isFinite(Number(text)) ? Number(text) : null;
    };
    const disability = { rate: amount('SHEUR-KISUY-NECHUT'), pension: amount('SACH-PENSIAT-NECHUT'), cost: amount('ALUT-KISUI-NECHUT') };
    const survivors = { cost: amount('ALUT-KISUY-SHEERIM'), spouse: { rate: amount('SHIUR-KISUY-ALMAN-O-ALMANA'), pension: amount('KITZBAT-SHEERIM-LEALMAN-O-ALMANA') }, orphan: { rate: amount('SHIUR-KISUY-YATOM'), pension: amount('KITZBAT-SHEERIM-LEYATOM') } };
    survivors.insuredSalary = amount('SACHAR-KOVEA-LE-NECHUT-VE-SHEERIM');
    for (const beneficiary of [survivors.spouse, survivors.orphan]) {
      beneficiary.reportedCoverageRate = beneficiary.rate;
      beneficiary.rate = survivorSalaryRate(beneficiary.pension, survivors.insuredSalary);
    }
    return { ...card, provider: accountProvider(node) || card.provider, detailData: { ...card.detailData, ...readDepositHistory(node),
      employers: accountEmployers(node),
      currentEmployers: accountEmployers(node, { currentOnly: true }),
      disability: Object.values(disability).some(value => value != null) ? disability : null,
      survivors: [survivors.cost, survivors.spouse.rate, survivors.spouse.pension, survivors.orphan.rate, survivors.orphan.pension].some(value => value != null) ? survivors : null,
      openedAt: date(read(node, 'TAARICH-HITZTARFUT-MUTZAR') || read(node, 'TAARICH-HITZTARFUT-RISHON')),
      updatedAt: date(read(node, 'TAARICH-NECHONUT')),
    } };
  });
}
