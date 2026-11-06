// כרטיסי placeholder בזמן טעינת נתוני מסלקה - תופסים מראש את הצורה הסופית של הדף
// (במקום מסך "טוען..." ריק), בהשראת חוויית הטעינה של קאבר.
export default function PageSkeleton({ title, rows = 4 }) {
  return (
    <div className="page">
      <div className="page-header">
        <h2 style={{ opacity: 0.4 }}>{title}</h2>
      </div>
      <div className="summary-card" style={{ background: '#e2e8f0', boxShadow: 'none' }}>
        <div className="skeleton" style={{ width: '140px', height: '32px', margin: '0 auto 10px' }} />
        <div className="skeleton" style={{ width: '90px', height: '14px', margin: '0 auto' }} />
      </div>
      <div className="chart-card" style={{ padding: '14px 0' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < rows - 1 ? '1px solid #f1f5f9' : 'none' }}
          >
            <div className="skeleton" style={{ width: '120px', height: '14px' }} />
            <div className="skeleton" style={{ width: '60px', height: '14px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
