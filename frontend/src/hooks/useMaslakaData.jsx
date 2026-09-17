import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from './useAuth';
import { useSandbox } from './useSandboxData';

// מצב נתוני מסלקה של הלקוח המחובר - נטען מה-DB (הוזן ע"י הסוכן בעמוד /import).
const MaslakaDataContext = createContext(null);

export function MaslakaDataProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [pensionOverride, setPensionOverride] = useState(null);
  const [insuranceOverride, setInsuranceOverride] = useState(null);
  const [harBituachOverride, setHarBituachOverride] = useState(null);
  const [clientInfo, setClientInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    api.get('/client-profile/financial-data')
      .then(({ data }) => {
        setPensionOverride(data?.pension_data || null);
        setInsuranceOverride(data?.insurance_data || null);
        setHarBituachOverride(data?.har_bituach_data || null);
        setClientInfo(data?.client_info || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  return (
    <MaslakaDataContext.Provider value={{ pensionOverride, setPensionOverride, insuranceOverride, setInsuranceOverride, harBituachOverride, setHarBituachOverride, clientInfo, setClientInfo, loading }}>
      {children}
    </MaslakaDataContext.Provider>
  );
}

// בתוך /admin/parser-test/* מציגים את נתוני הסנדבוקס (אם נטענו) במקום הנתונים האמיתיים של
// המשתמש המחובר - מוגבל לנתיב הזה בלבד כדי שלא "יזלוג" לשאר האפליקציה.
export function useMaslakaData() {
  const sandbox = useSandbox();
  const real = useContext(MaslakaDataContext);
  const isSandboxRoute = useLocation().pathname.startsWith('/admin/parser-test');
  if (isSandboxRoute && sandbox?.sandboxData) {
    return { ...sandbox.sandboxData, loading: false };
  }
  return real;
}
