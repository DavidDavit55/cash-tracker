import { useState, useEffect, createContext, useContext } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.get('/auth/me').then(r => setUser(r.data)).catch(() => localStorage.removeItem('token')).finally(() => setLoading(false));
  }, []);

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

  return <AuthContext.Provider value={{ user, loading, loginSendCode, loginCheckCode, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
