// ריסק זמני - הכיסוי הביטוחי עדיין פעיל, רק ההפקדות מוקפאות - אזהרה צהובה, לא אדומה.
// כל סטטוס לא-פעיל אחר - אזהרה אדומה. אם אין סטטוס מובנה, נופל לאזהרה שכבר חושבה (למשל טקסט חופשי מהר ביטוח).
export function statusWarning(p) {
  if (p.status === 'ריסק זמני') return { warning: 'yellow', warningText: 'ריסק זמני' };
  if (p.status && p.status !== 'פעיל') return { warning: 'red', warningText: 'לא פעיל' };
  return { warning: p.warning, warningText: p.warningText };
}
