const fmt = (n) => `₪ ${Math.abs(n).toLocaleString('he-IL')}`;

export default function NetWorthCard({ data }) {
  const { current, changeAmount, changePercent, changePeriodLabel, assets, liabilities } = data;
  const assetsPct = Math.round((assets / (assets + liabilities)) * 100);

  return (
    <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-2xl p-5 mb-5 relative overflow-hidden shadow-sm">
      <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl" />

      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">השווי הנקי שלך (Net Worth)</span>
      <div className="text-3xl font-extrabold text-slate-900 mb-2" dir="ltr" style={{ textAlign: 'right' }}>{fmt(current)}</div>

      <div className="flex items-center gap-2 mb-4">
        <span className="bg-emerald-50 text-emerald-600 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
          ▲ +{fmt(changeAmount)} ({changePercent}%+)
        </span>
        <span className="text-xs text-slate-500">{changePeriodLabel}</span>
      </div>

      <div className="space-y-1.5">
        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
          <div className="bg-sky-500 h-full" style={{ width: `${assetsPct}%` }} />
          <div className="bg-rose-400 h-full" style={{ width: `${100 - assetsPct}%` }} />
        </div>
        <div className="flex justify-between text-[11px] font-medium">
          <span className="text-sky-600">נכסים: {fmt(assets)}</span>
          <span className="text-rose-500">התחייבויות: {fmt(liabilities)}</span>
        </div>
      </div>
    </div>
  );
}
