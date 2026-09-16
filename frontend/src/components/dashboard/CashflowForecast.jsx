const fmt = (n) => `₪ ${n.toLocaleString('he-IL')}`;

export default function CashflowForecast({ forecast }) {
  const { monthLabel, expectedIncome, expectedExpenses } = forecast;
  const surplus = expectedIncome - expectedExpenses;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-5 shadow-sm">
      <h2 className="text-sm font-bold text-slate-700 mb-3">📊 תחזית תזרים - {monthLabel}</h2>

      <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
        <div className="bg-slate-50 p-2.5 rounded-xl">
          <span className="text-slate-500 block mb-0.5">הכנסות צפויות</span>
          <span className="font-bold text-emerald-600 text-sm">{fmt(expectedIncome)}</span>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-xl">
          <span className="text-slate-500 block mb-0.5">הוצאות צפויות</span>
          <span className="font-bold text-slate-700 text-sm">{fmt(expectedExpenses)}</span>
        </div>
      </div>

      <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200">
        <span className="text-slate-500">עודף תזרימי צפוי:</span>
        <span className="font-bold text-emerald-600">+{fmt(surplus)}</span>
      </div>
    </div>
  );
}
