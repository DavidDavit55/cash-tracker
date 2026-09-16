import { useState } from 'react';
import { AGENT_WHATSAPP } from '../../mockData';

const REASONS = [
  { key: 'expensive', label: 'יקר לי' },
  { key: 'unnecessary', label: 'לא חושב שאני צריך' },
  { key: 'confused', label: 'לא הבנתי איך' },
  { key: 'other', label: 'משהו אחר' },
];

export default function CoverageGapWidget({ missingLabel }) {
  const [selected, setSelected] = useState(null);

  const waLink = (reasonLabel) => {
    const text = `היי, שמתי לב באפליקציה שאין לי ${missingLabel}. הסיבה: ${reasonLabel}. אשמח שתעזור לי להבין את האפשרויות.`;
    return `https://wa.me/${AGENT_WHATSAPP}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="chart-card" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
      <h3 style={{ color: '#92400e' }}>⚠️ שמנו לב שאין לך {missingLabel}</h3>
      <p style={{ fontSize: '0.82rem', color: '#78350f', marginBottom: '10px' }}>מה הסיבה שאין לך את זה כרגע?</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {REASONS.map(r => (
          <button
            key={r.key}
            onClick={() => setSelected(r.key)}
            style={{
              padding: '6px 12px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              border: selected === r.key ? '1px solid #d97706' : '1px solid #fde68a',
              background: selected === r.key ? '#f59e0b' : '#fff',
              color: selected === r.key ? '#fff' : '#92400e',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {selected && (
        <a
          href={waLink(REASONS.find(r => r.key === selected).label)}
          target="_blank" rel="noreferrer"
          style={{ display: 'block', textAlign: 'center', marginTop: '12px', padding: '9px', borderRadius: '8px', background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}
        >
          קבל בדיקה אישית ממומחה
        </a>
      )}
    </div>
  );
}
