import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from './useAuth';

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

export const useMaslakaData = () => useContext(MaslakaDataContext);
