import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const fmt = (n) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

// כרטיס מוצר עם accordion לפרטים נוספים + CTA (קישור וואטסאפ או ניווט פנימי)
export default function ProductCard({ name, subtitle, amount, amountColor = 'var(--text)', details, ctaLabel, ctaHref, ctaOnClick, borderBottom = true }) {
  const [open, setOpen] = useState(false);
  const hasExtra = !!details || !!ctaLabel;

  return (
    <div style={{ borderBottom: borderBottom ? '1px solid #f1f5f9' : 'none' }}>
      <button
        onClick={() => hasExtra && setOpen(o => !o)}
        disabled={!hasExtra}
        style={{ width: '100%', background: 'none', border: 'none', cursor: hasExtra ? 'pointer' : 'default', padding: '10px 16px', textAlign: 'right' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
          {hasExtra && <span style={{ color: '#94a3b8' }}>{open ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}</span>}
          <span style={{ fontWeight: 500, flex: 1, textAlign: 'right', margin: '0 6px' }}>{name}</span>
          <span style={{ fontWeight: 700, color: amountColor, direction: 'ltr' }}>{amount}</span>
        </div>
        {subtitle && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '3px', textAlign: 'right' }}>{subtitle}</div>}
      </button>

      {open && (
        <div style={{ background: '#f8fafc', padding: '10px 16px 14px' }}>
          {details}
          {ctaLabel && (
            <a
              href={ctaHref} target={ctaHref?.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
              onClick={ctaOnClick}
              style={{ display: 'block', textAlign: 'center', marginTop: '10px', padding: '9px', borderRadius: '8px', background: 'var(--success)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}
            >
              {ctaLabel}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
