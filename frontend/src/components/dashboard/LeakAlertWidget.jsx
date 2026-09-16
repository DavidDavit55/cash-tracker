export default function LeakAlertWidget({ leaks, onAction }) {
  if (!leaks.length) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🚨</span>
          <h2 className="text-sm font-bold text-amber-800">צ'ק-אפ: נמצאו {leaks.length} דליפות</h2>
        </div>
        <span className="text-[10px] bg-amber-200/60 text-amber-700 font-bold px-2 py-0.5 rounded">חיסכון מתוכנן</span>
      </div>

      {leaks.map((leak, i) => (
        <div
          key={leak.id}
          className={`bg-white rounded-xl p-3 border border-slate-200 flex justify-between items-center ${i < leaks.length - 1 ? 'mb-2' : ''}`}
        >
          <div>
            <div className="text-xs font-semibold text-slate-700">{leak.title}</div>
            <div className={`text-[11px] font-medium ${leak.detailColor === 'success' ? 'text-emerald-600' : 'text-slate-500'}`}>
              {leak.detail}
            </div>
          </div>
          {leak.ctaType === 'action' ? (
            <button
              onClick={() => onAction?.(leak)}
              className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
            >
              {leak.ctaLabel}
            </button>
          ) : (
            <button onClick={() => onAction?.(leak)} className="text-xs text-sky-600 font-semibold hover:underline">
              {leak.ctaLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
