import { useNavigate } from 'react-router-dom';
import { accounts, liabilities, buildWhatsAppLink } from '../mockData';
import { useMaslakaData } from '../hooks/useMaslakaData';
import { useIsPreviewRoute } from '../hooks/useIsPreviewRoute';
import PendingDataScreen from '../components/PendingDataScreen';
import ProductCard, { fmt } from '../components/ProductCard';

function AccountCard({ item, borderBottom, previewMode }) {
  const navigate = useNavigate();
  const budgetsPath = previewMode ? '/preview/budgets' : '/budgets';

  if (item.type === 'checking') {
    return (
      <ProductCard
        name={item.name}
        amount={fmt(item.balance)}
        borderBottom={borderBottom}
        details={
          <div>
            {item.recentTransactions.map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '5px 0', borderTop: i > 0 ? '1px solid #e2e8f0' : 'none' }}>
                <span>{t.desc}</span>
                <span style={{ color: t.amount < 0 ? '#ef4444' : '#22c55e', direction: 'ltr' }}>{t.amount > 0 ? '+' : ''}{fmt(t.amount)}</span>
              </div>
            ))}
          </div>
        }
        ctaLabel="לתקציב שלי"
        ctaHref={budgetsPath}
        ctaOnClick={(e) => { e.preventDefault(); navigate(budgetsPath); }}
      />
    );
  }

  return (
    <ProductCard
      name={item.name}
      amount={fmt(item.balance)}
      amountColor="#22c55e"
      borderBottom={borderBottom}
      details={
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
          <div>ריבית: <b style={{ color: 'var(--text)' }}>{item.rate}%</b></div>
          <div>תחנת יציאה קרובה: <b style={{ color: 'var(--text)' }}>{new Date(item.nextExitDate).toLocaleDateString('he-IL')}</b></div>
        </div>
      }
      ctaLabel="השווה עבורי"
      ctaHref={buildWhatsAppLink(item.name, `${fmt(item.balance)}, ריבית ${item.rate}%`)}
    />
  );
}

function LiabilityCard({ item, borderBottom }) {
  if (item.type === 'mortgage') {
    return (
      <ProductCard
        name={item.name}
        subtitle={`החזר חודשי: ${fmt(item.monthlyPayment)}`}
        amount={fmt(item.balance)}
        amountColor="#ef4444"
        borderBottom={borderBottom}
        details={
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {item.tracks.map((t, i) => (
              <div key={i} style={{ padding: '6px 0', borderTop: i > 0 ? '1px solid #e2e8f0' : 'none' }}>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{t.name}</div>
                <div>ריבית: {t.rate}% · יתרה: {fmt(t.balance)} · תשלום אחרון: {new Date(t.lastPaymentDate).toLocaleDateString('he-IL')}</div>
              </div>
            ))}
          </div>
        }
        ctaLabel="השווה עבורי"
        ctaHref={buildWhatsAppLink(item.name, `יתרה ${fmt(item.balance)}`)}
      />
    );
  }

  if (item.type === 'credit') {
    return (
      <ProductCard
        name={item.name}
        amount={fmt(item.balance)}
        amountColor="#ef4444"
        borderBottom={borderBottom}
        details={
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
            <div>נוצל מהמסגרת: <b style={{ color: 'var(--text)' }}>{fmt(item.utilized)} / {fmt(item.creditLimit)}</b></div>
            <div>חיוב קרוב: <b style={{ color: 'var(--text)' }}>{fmt(item.upcomingChargeAmount)}</b> בתאריך <b style={{ color: 'var(--text)' }}>{new Date(item.upcomingChargeDate).toLocaleDateString('he-IL')}</b></div>
          </div>
        }
        ctaLabel="השווה עבורי"
        ctaHref={buildWhatsAppLink(item.name, `יתרה ${fmt(item.balance)}`)}
      />
    );
  }

  return (
    <ProductCard
      name={item.name}
      subtitle={item.monthlyPayment ? `החזר חודשי: ${fmt(item.monthlyPayment)}` : undefined}
      amount={fmt(item.balance)}
      amountColor="#ef4444"
      borderBottom={borderBottom}
      details={
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
          <div>ריבית: <b style={{ color: 'var(--text)' }}>{item.rate}%</b></div>
          <div>תאריך סיום הלוואה: <b style={{ color: 'var(--text)' }}>{new Date(item.endDate).toLocaleDateString('he-IL')}</b></div>
        </div>
      }
      ctaLabel="השווה עבורי"
      ctaHref={buildWhatsAppLink(item.name, `יתרה ${fmt(item.balance)}, ריבית ${item.rate}%`)}
    />
  );
}

export default function Assets({ previewMode }) {
  const { pensionOverride, insuranceOverride, harBituachOverride, loading: maslakaLoading } = useMaslakaData() || {};
  const isPreview = useIsPreviewRoute();
  const hasRealData = Boolean(pensionOverride) || Boolean(insuranceOverride) || Boolean(harBituachOverride);

  if (maslakaLoading) return <div className="loading full">טוען...</div>;
  if (!hasRealData && !isPreview && !import.meta.env.DEV) {
    return <PendingDataScreen />;
  }

  const accountsTotal = accounts.reduce((s, a) => s + a.balance, 0);
  const liabilitiesTotal = liabilities.reduce((s, l) => s + l.balance, 0);

  return (
    <div className="page">
      <div className="page-header"><h2>עו"ש, חיסכון והתחייבויות</h2></div>

      <div className="chart-card" style={{ padding: '14px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px 10px' }}>
          <h3>עו"ש, חיסכון ופיקדונות</h3>
          <span style={{ fontWeight: 700, color: '#22c55e' }}>{fmt(accountsTotal)}</span>
        </div>
        {accounts.map((a, i) => <AccountCard key={a.id} item={a} borderBottom={i < accounts.length - 1} previewMode={previewMode} />)}
      </div>

      <div className="chart-card" style={{ padding: '14px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px 10px' }}>
          <h3>הלוואות, משכנתא ואשראי</h3>
          <span style={{ fontWeight: 700, color: '#ef4444' }}>-{fmt(liabilitiesTotal)}</span>
        </div>
        {liabilities.map((l, i) => <LiabilityCard key={l.id} item={l} borderBottom={i < liabilities.length - 1} />)}
      </div>
    </div>
  );
}
