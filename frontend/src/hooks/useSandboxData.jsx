import { createContext, useContext, useState } from 'react';

// "צפה כמו לקוח" מתוך /admin/parser-test - טוען קובץ אמיתי לזיכרון (לא ל-DB) ומאפשר לראות
// אותו דרך מסכי הלקוח האמיתיים (Pension/Protection/NetWorth), בלי ליצור חשבון מזויף.
const SandboxContext = createContext(null);

export function SandboxProvider({ children }) {
  const [sandboxData, setSandboxData] = useState(null);
  return (
    <SandboxContext.Provider value={{ sandboxData, setSandboxData, clearSandbox: () => setSandboxData(null) }}>
      {children}
    </SandboxContext.Provider>
  );
}

export const useSandbox = () => useContext(SandboxContext);
