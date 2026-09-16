import { useState } from 'react';

// ponytail: percentile מבוסס נתוני הלמ"ס זמניים - להחליף בממוצע אנונימי אמיתי כשיהיה מספיק משתמשים
const CATEGORIES = [
  { key: 'netWorth', label: 'שווי נקי', percentile: 72, color: '#22c55e', ageRange: '35-40' },
  { key: 'pension', label: 'חיסכון פנסיוני', percentile: 58, color: '#6366f1', ageRange: '35-40' },
  { key: 'savingsRate', label: 'קצב חיסכון', percentile: 41, color: '#f59e0b', ageRange: '35-40' },
];

const R = 54;
const CIRCUMFERENCE = 2 * Math.PI * R;

export default function PeerComparisonWidget() {
  const [activeKey, setActiveKey] = useState(CATEGORIES[0].key);
  const active = CATEGORIES.find(c => c.key === activeKey);
  const offset = CIRCUMFERENCE * (1 - active.percentile / 100);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 mb-5 shadow-sm">
      <h2 className="text-sm font-bold text-slate-700 mb-4">איך אתה מול בני גילך?</h2>

      <div className="flex gap-2 mb-5 justify-center">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => setActiveKey(c.key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
              c.key === activeKey ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
            style={c.key === activeKey ? { background: c.color } : undefined}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center">
        <div className="relative w-36 h-36">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" stroke="#f1f5f9" strokeWidth="10" />
            <circle
              cx="60" cy="60" r={R} fill="none"
              stroke={active.color} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold text-slate-800" style={{ transition: 'color 0.3s ease' }}>{active.percentile}%</span>
            <span className="text-[10px] text-slate-400">פרסנטיל</span>
          </div>
        </div>

        <p className="text-sm text-slate-600 mt-4 text-center leading-relaxed">
          אתה ב-<b style={{ color: active.color }}>{100 - active.percentile}% העליונים</b> מבני גילך
          <span className="text-slate-400"> (גילאי {active.ageRange})</span>
        </p>
        <p className="text-[11px] text-slate-400 mt-1">הערכה מבוססת נתוני הלמ"ס</p>
      </div>
    </div>
  );
}
