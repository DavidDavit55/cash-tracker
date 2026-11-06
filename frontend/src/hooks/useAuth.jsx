import { useState, useEffect, createContext, useContext } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(false);
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    const staging = import.meta.env.VITE_APP_ENV === 'staging';
    api.get('/auth/me', staging ? {timeout:15000} : {}).then(r => {if(active)setUser(r.data);}).catch(err => {
      if(!active)return;
      if(!staging || err.response?.status===401) localStorage.removeItem('token');
      else setLoadError(true);
    }).finally(() => {if(active)setLoading(false);});
    return ()=>{active=false;};
  }, [attempt]);

  const loginSendCode = async (phone) => {
    await api.post('/auth/login/send', { phone });
  };

  const loginCheckCode = async (phone, code) => {
    const { data } = await api.post('/auth/login/check', { phone, code });
    localStorage.setItem('token', data.token);
    setUser(data.user);
  };

  const register = async (name, email, phone) => {
    const { data } = await api.post('/auth/register', { name, email, phone });
    localStorage.setItem('token', data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, loginSendCode, loginCheckCode, register, logout }}>{loadError?<section dir="rtl" role="alert" style={{padding:'2rem'}}><h2>לא ניתן לטעון כרגע את סביבת הבדיקה</h2><p>השרת לא השלים את הבקשה. פרטי הכניסה נשמרו; אין צורך למחוק נתונים.</p><button onClick={()=>{setLoading(true);setLoadError(false);setAttempt(n=>n+1);}}>ניסיון חוזר</button></section>:children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
