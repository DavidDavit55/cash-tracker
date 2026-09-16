import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { netWorthHistory, accounts, liabilities, pensionFunds, computeNetWorth } from '../mockData';

const fmt = (n) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

export default function NetWorth() {
  const { user } = useAuth();
  const { netWorth } = computeNetWorth();

  const categories = [
    { name: 'עו"ש, חיסכון ופיקדונות', total: accounts.reduce((s, a) => s + a.balance, 0), color: '#6366f1' },
    { name: 'גמל ופנסיה', total: pensionFunds.reduce((s, p) => s + p.balance, 0), color: '#22c55e' },
    { name: 'הלוואות ומשכנתא', total: -liabilities.reduce((s, l) => s + l.balance, 0), color: '#ef4444' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h2>שלום, {user?.name} 👋</h2>
      </div>

      <div className="summary-card" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
        <div className="summary-amount">{fmt(netWorth)}</div>
        <div className="summary-label">השווי הנקי שלך</div>
      </div>

      <div className="chart-card" style={{ padding: '14px 0' }}>
        <h3 style={{ padding: '0 16px 10px' }}>פירוט לפי קטגוריה</h3>
        {categories.map((cat, i) => (
          <div key={i} style={{ padding: '10px 16px', borderBottom: i < categories.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
              <span style={{ fontWeight: 500 }}>{cat.name}</span>
              <span style={{ fontWeight: 700, color: cat.total < 0 ? '#ef4444' : cat.color, direction: 'ltr' }}>
                {cat.total < 0 ? '-' : ''}{fmt(Math.abs(cat.total))}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="chart-card">
        <h3>מגמת שווי נקי</h3>
        <ResponsiveContainer width="100%" height={180} dir="ltr">
          <LineChart data={netWorthHistory}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} domain={['dataMin - 5000', 'dataMax + 5000']} />
            <Tooltip formatter={v => fmt(v)} />
            <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
