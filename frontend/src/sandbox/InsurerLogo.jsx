import { useState } from 'react';

import { findBrand } from './providerBrands';


export default function InsurerLogo({ provider, fallback = 'חברת ביטוח' }) {
  const [failed, setFailed] = useState(null);
  const name = String(provider || '').normalize('NFKC').replace(/[\u200e\u200f]/g, '');
  const brand = findBrand(name);
  return <span className="sb-insurer-logo">{brand?.file && failed !== brand.file
    ? <img src={`/sandbox-insurers/${brand.file}`} alt={`לוגו ${brand.name}`} onError={() => setFailed(brand.file)} />
    : <span>{brand?.name || name || fallback}</span>}</span>;
}
