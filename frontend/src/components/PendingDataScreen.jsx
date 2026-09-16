export default function PendingDataScreen() {
  return (
    <div className="page">
      <div className="empty-state" style={{ marginTop: '60px' }}>
        <div className="empty-icon">⏳</div>
        <h3 style={{ marginBottom: '8px' }}>אנחנו עובדים על זה</h3>
        <p>
          קיבלנו את הפרטים שלך ואנחנו שולפים כרגע את הנתונים הפיננסיים שלך
          מהמסלקה ומהר ביטוח. ברגע שהם מוכנים, התמונה המלאה תופיע כאן.
        </p>
      </div>
    </div>
  );
}
