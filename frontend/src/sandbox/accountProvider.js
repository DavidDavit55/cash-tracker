// A multi-company XML must resolve the manufacturer enclosing THIS account,
// never the first SHEM-YATZRAN anywhere in the document.
export function accountProvider(account) {
  let node = account.parentElement;
  while (node) {
    if (node.localName === 'YeshutYatzran') {
      const value = [...node.children].find(child => child.localName === 'SHEM-YATZRAN')?.textContent.trim();
      return value && value !== 'NULL' ? value : null;
    }
    node = node.parentElement;
  }
  return null;
}
