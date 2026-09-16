import '../tailwind.css';
import { useAuth } from '../hooks/useAuth';
import NetWorthCard from '../components/dashboard/NetWorthCard';
import LeakAlertWidget from '../components/dashboard/LeakAlertWidget';
import CashflowForecast from '../components/dashboard/CashflowForecast';
import ConnectedAccounts from '../components/dashboard/ConnectedAccounts';
import PeerComparisonWidget from '../components/dashboard/PeerComparisonWidget';
import { netWorthData, leaks, cashflowForecast, connectedAccounts } from '../data/dashboardMock';

const NAV_ITEMS = [
  { key: 'home', icon: '🏠', label: 'הבית' },
  { key: 'cashflow', icon: '📊', label: 'תזרים' },
  { key: 'checkup', icon: '🔍', label: "צ'ק-אפ" },
  { key: 'settings', icon: '⚙️', label: 'הגדרות' },
];

export default function DashboardV2() {
  const { user } = useAuth();
  const initials = (user?.name || 'דד').slice(0, 2);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-[40px] border border-slate-200 p-6 shadow-xl overflow-hidden relative">

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">שלום {user?.name || 'דוד'} 👋</h1>
            <p className="text-xs text-slate-500">תמונת המצב הכלכלית שלך להיום</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-sky-500">
            {initials}
          </div>
        </div>

        <NetWorthCard data={netWorthData} />
        <PeerComparisonWidget />
        <LeakAlertWidget leaks={leaks} />
        <CashflowForecast forecast={cashflowForecast} />
        <ConnectedAccounts accounts={connectedAccounts} />

        <div className="flex justify-between items-center pt-3 border-t border-slate-200 text-slate-400 text-xs">
          {NAV_ITEMS.map((item, i) => (
            <button key={item.key} className={`flex flex-col items-center gap-1 ${i === 0 ? 'text-sky-500 font-bold' : 'hover:text-slate-600'}`}>
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
