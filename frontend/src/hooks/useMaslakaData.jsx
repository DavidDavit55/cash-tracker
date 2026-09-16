import { createContext, useContext, useState } from 'react';

// מצב משותף לנתוני מסלקה שיובאו - כדי שהזנה ב"ייבוא" (עמוד למנהל/סוכן, לא ללקוח)
// תשתקף במסכי גמל/פנסיה והגנות בלי שהלקוח יראה את כפתור הייבוא עצמו.
const MaslakaDataContext = createContext(null);

export function MaslakaDataProvider({ children }) {
  const [pensionOverride, setPensionOverride] = useState(null);
  const [insuranceOverride, setInsuranceOverride] = useState(null);
  const [clientInfo, setClientInfo] = useState(null); // { id, first, last, birth }
  return (
    <MaslakaDataContext.Provider value={{ pensionOverride, setPensionOverride, insuranceOverride, setInsuranceOverride, clientInfo, setClientInfo }}>
      {children}
    </MaslakaDataContext.Provider>
  );
}

export const useMaslakaData = () => useContext(MaslakaDataContext);
