export function accountEmployers(account, { currentOnly = false } = {}) {
  let product = account.parentElement;
  while (product && product.localName !== 'Mutzar') product = product.parentElement;
  if (!product) return [];
  const read = (node, tag) => [...node.getElementsByTagName(tag)][0]?.textContent.trim();
  const valid = value => value && value !== 'NULL' && value !== '0';
  const codes = new Set([...account.getElementsByTagName('PirteiOved')].filter(node => !currentOnly || read(node, 'STATUS-MAASIK') === '1').map(node => read(node, 'MPR-MAASIK-BE-YATZRAN')).filter(valid));
  return [...new Set([...product.getElementsByTagName('YeshutMaasik')]
    .filter(node => codes.has(read(node, 'MPR-MAASIK-BE-YATZRAN')))
    .map(node => read(node, 'SHEM-MAASIK')).filter(valid))];
}
