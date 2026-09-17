import { useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

// true בנתיבי /preview/* (הדגמה פנימית בלי login), וגם כשהאדמין עצמו מחובר בחשבון שלו -
// לו אין נתוני לקוח אמיתיים (הוא לא לקוח), אז בלי זה הוא תמיד רואה מסך "אנחנו עובדים על זה".
export function useIsPreviewRoute() {
  const isPreviewPath = useLocation().pathname.startsWith('/preview');
  const { user } = useAuth();
  const isAdmin = user && import.meta.env.VITE_ADMIN_EMAIL && user.email === import.meta.env.VITE_ADMIN_EMAIL;
  return isPreviewPath || isAdmin;
}
