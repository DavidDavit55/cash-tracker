const fmt = (n) => `${n < 0 ? '-' : ''}₪ ${Math.abs(n).toLocaleString('he-IL')}`;

export default function ConnectedAccounts({ accounts }) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {accounts.map(acc => (
        <div key={acc.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>{acc.name}</span>
            <span className={`w-2 h-2 rounded-full ${acc.status === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          </div>
          <div className="font-bold text-slate-800 text-sm" dir="ltr" style={{ textAlign: 'right' }}>{fmt(acc.balance)}</div>
        </div>
      ))}
    </div>
  );
}
