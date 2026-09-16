// ponytail: mock read-only לצורך דמו בלבד (Budgets.jsx האמיתי דורש backend+DB) — למחוק כש-previewMode יורד
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const mockBudgets = [
  { id: 1, icon: '🛒', category_name: 'סופרמרקט', amount: 2500, spent: 1840, color: '#6366f1' },
  { id: 2, icon: '🍔', category_name: 'מסעדות', amount: 800, spent: 960, color: '#ef4444' },
  { id: 3, icon: '⛽', category_name: 'דלק ותחבורה', amount: 600, spent: 410, color: '#22c55e' },
  { id: 4, icon: '🎬', category_name: 'בילויים', amount: 400, spent: 155, color: '#f59e0b' },
];

export default function PreviewBudgets() {
  const [expanded, setExpanded] = useState(null);
  const totalBudget = mockBudgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = mockBudgets.reduce((s, b) => s + b.spent, 0);
  const over = totalSpent > totalBudget;

  return (
    <div className="page">
      <div className="page-header"><h2>תקציבים</h2></div>

      <div className="summary-card" style={{ background: over ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', marginBottom: '12px' }}>
        <div className="summary-amount">₪{totalSpent.toLocaleString('he-IL')} / ₪{totalBudget.toLocaleString('he-IL')}</div>
        <div className="summary-label">סה"כ הוצאות מתוך תקציב</div>
      </div>

      <div className="card">
        {mockBudgets.map(b => {
          const pct = Math.min(100, (b.spent / b.amount) * 100);
          const isOver = b.spent > b.amount;
          const isOpen = expanded === b.id;
          return (
            <div key={b.id} className="budget-card">
              <div className="budget-header" onClick={() => setExpanded(isOpen ? null : b.id)} style={{ cursor: 'pointer' }}>
                <span className="budget-cat">{b.icon} {b.category_name}</span>
                <div className="budget-amounts">
                  <span className={isOver ? 'over-budget' : ''}>₪{b.spent}</span>
                  <span className="budget-sep"> / </span>
                  <span>₪{b.amount}</span>
                  {isOpen ? <ChevronUp size={16} style={{ color: '#94a3b8' }} /> : <ChevronDown size={16} style={{ color: '#94a3b8' }} />}
                </div>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%`, background: isOver ? '#ef4444' : b.color }} />
              </div>
              <div className="budget-remaining">
                {isOver ? `חרגת ב-₪${b.spent - b.amount}` : `נותר ₪${b.amount - b.spent}`}
              </div>
              {isOpen && (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', padding: '8px', borderTop: '1px solid #f1f5f9', marginTop: '8px' }}>
                  (נתוני דמו — הוצאות בפועל יופיעו כאן)
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
