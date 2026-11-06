const identity = value => String(value || '').trim().replace(/^0+(?=\d)/, '');
const descendants = (node, tag) => [...node.getElementsByTagName(tag)];
const directId = node => identity([...node.children].find(n => n.localName === 'MISPAR-ZIHUY-LAKOACH')?.textContent);

// Validate each source document before filtering. Secondary insureds are not report owners.
// Mixed policies need human review: their totals cannot safely be split by insured.
export function prepareMaslakaUpload(files, clientIdentity) {
  const expected = identity(clientIdentity);
  const excludedPolicies = [];
  const customerEmails=new Set();
  const profileValues={name:new Set(),birth:new Set()};
  const prepared = files.map(file => {
    const doc = new DOMParser().parseFromString(file.text, 'text/xml');
    if (doc.querySelector('parsererror')) throw Error('אחד מקובצי המסלקה אינו XML תקין.');
    const owners = descendants(doc, 'YeshutLakoach').map(directId);
    if (!expected || !owners.length || owners.some(id => !id || id !== expected)) {
      throw Error('הלקוח הראשי במסלקה אינו תואם לת״ז בתיק, או שאין זיהוי ברור של בעל הדוח. הקליטה נעצרה.');
    }
    for(const owner of descendants(doc,'YeshutLakoach'))for(const node of [...owner.children].filter(n=>n.localName==='E-MAIL')){
      const email=node.textContent.trim().toLowerCase();
      if(/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email))customerEmails.add(email);
    }
    for(const owner of descendants(doc,'YeshutLakoach')){
      const field=tag=>[...owner.children].find(n=>n.localName===tag)?.textContent?.trim()||'';
      const name=[field('SHEM-PRATI'),field('SHEM-MISHPACHA')].filter(Boolean).join(' ');
      if(name)profileValues.name.add(name);
      const raw=field('TAARICH-LEYDA'),birth=/^\d{8}$/.test(raw)?`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6)}`:raw;
      if(/^\d{4}-\d{2}-\d{2}$/.test(birth)&&Number.isFinite(Date.parse(birth))&&new Date(birth).toISOString().slice(0,10)===birth)profileValues.birth.add(birth);
    }
    for (const policy of descendants(doc, 'HeshbonOPolisa')) {
      const insureds = descendants(policy, 'PirteiMevutach');
      if (insureds.some(insured => directId(insured) !== expected)) {
        excludedPolicies.push({
          policy: [...policy.children].find(n => n.localName === 'MISPAR-POLISA-O-HESHBON')?.textContent?.trim() || 'ללא מספר',
          reason: 'מבוטח נוסף או זיהוי מבוטח חסר — נדרשת בדיקה לפני שיוך',
        });
        policy.remove();
      }
    }
    return { ...file, text: new XMLSerializer().serializeToString(doc) };
  });
  const customerProfile={identity:String(clientIdentity).trim(),source:'מסלקה — פרטי הלקוח הראשי',conflicts:[]};
  for(const [key,values] of Object.entries(profileValues))if(values.size===1)customerProfile[key]=[...values][0];else if(values.size>1)customerProfile.conflicts.push(key==='name'?'שם הלקוח':'תאריך לידה');
  return { files: prepared, excludedPolicies, customerEmails:[...customerEmails],customerProfile };
}
