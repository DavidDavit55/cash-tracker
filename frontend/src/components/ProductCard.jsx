import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

export const fmt = (n) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

const WARNING_COLORS = { red: '#ef4444', yellow: '#f59e0b' };

// כרטיס מוצר עם accordion לפרטים נוספים + CTA (קישור וואטסאפ או ניווט פנימי)
// warning: 'red' | 'yellow' - משולש אזהרה ליד השם (לדוגמה: קרן לא פעילה / ריסק זמני)
// badge: תג טקסט קטן ליד השם (לדוגמה: "משועבד")
// sheet: true -> הפרטים נפתחים ב-bottom sheet (מודל שגולש ממטה, בהשראת Cover) במקום accordion פנימי.
// שאר השימושים בקומפוננטה נשארים accordion רגיל, ברירת המחדל.
export default function ProductCard({ name, subtitle, amount, amountColor = 'var(--text)', details, ctaLabel, ctaHref, ctaOnClick, borderBottom = true, warning, warningText, badge, sheet = false }) {
  const [open, setOpen] = useState(false);
  const hasExtra = !!details || !!ctaLabel;

  const cta = ctaLabel && (
    <a
      href={ctaHref} target={ctaHref?.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
      onClick={ctaOnClick}
      style={{ display: 'block', textAlign: 'center', marginTop: '10px', padding: '9px', borderRadius: '8px', background: 'var(--success)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}
    >
      {ctaLabel}
    </a>
  );

  return (
    <div style={{ borderBottom: borderBottom ? '1px solid #f1f5f9' : 'none' }}>
      <button
        onClick={() => hasExtra && setOpen(o => !o)}
        disabled={!hasExtra}
        style={{ width: '100%', background: 'none', border: 'none', cursor: hasExtra ? 'pointer' : 'default', padding: '10px 16px', textAlign: 'right' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
          {hasExtra && !sheet && <span style={{ color: '#94a3b8' }}>{open ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}</span>}
          <span style={{ fontWeight: 500, flex: 1, textAlign: 'right', margin: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
            {warning && <AlertTriangle size={14} color={WARNING_COLORS[warning]} title={warningText}/>}
            {name}
            {badge && <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', borderRadius: '4px', padding: '1px 6px' }}>{badge}</span>}
          </span>
          <span style={{ fontWeight: 700, color: amountColor, direction: 'ltr' }}>{amount}</span>
        </div>
        {subtitle && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '3px', textAlign: 'right' }}>{subtitle}</div>}
        {warningText && <div style={{ color: WARNING_COLORS[warning], fontSize: '0.72rem', marginTop: '3px', textAlign: 'right' }}>{warningText}</div>}
      </button>

      {open && !sheet && (
        <div style={{ background: '#f8fafc', padding: '10px 16px 14px' }}>
          {details}
          {cta}
        </div>
      )}

      {open && sheet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <div onClick={() => setOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85vh', overflowY: 'auto',
            background: '#fff', borderRadius: '20px 20px 0 0', padding: '10px 20px 28px',
            boxShadow: '0 -8px 30px rgba(0,0,0,0.2)', animation: 'sheet-up 0.22s ease-out',
          }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: '#e2e8f0', margin: '0 auto 14px' }} />
            <button onClick={() => setOpen(false)} style={{ position: 'absolute', top: '14px', left: '16px', background: 'none', border: 'none', fontSize: '1.3rem', color: '#94a3b8', cursor: 'pointer', lineHeight: 1 }}>×</button>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '2px' }}>{name}</div>
            {subtitle && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '14px' }}>{subtitle}</div>}
            <div style={{ fontWeight: 700, fontSize: '1.4rem', color: amountColor, direction: 'ltr', marginBottom: '14px' }}>{amount}</div>
            {details}
            {cta}
          </div>
        </div>
      )}
    </div>
  );
}
