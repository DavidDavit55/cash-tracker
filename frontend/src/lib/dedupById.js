// אותה פוליסה יכולה להופיע גם במקור אחד וגם באחר (למשל: גם במסלקה וגם בהר ביטוח, אותו
// מספר פוליסה) - שומר רק את ההופעה הראשונה כדי לא לספור פעמיים בסך הכל/בתצוגה.
export function dedupById(items) {
  const seen = new Map();
  for (const item of items) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()];
}
