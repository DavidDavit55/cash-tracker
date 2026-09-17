import { useLocation } from 'react-router-dom';

// true רק בנתיבי /preview/* (הדגמה פנימית בלי login) - שם תמיד מציגים mock
export function useIsPreviewRoute() {
  return useLocation().pathname.startsWith('/preview');
}
