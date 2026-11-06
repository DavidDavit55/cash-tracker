import { NavLink } from 'react-router-dom';
import { Users, Upload, LogOut, Wallet, Mail } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import BrandLogo from '../sandbox/BrandLogo';
import './AdminLayout.css';

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  return <div className="admin-shell" dir="rtl">
    <header><NavLink to="/admin/clients" aria-label="NETWORTH — ניהול לקוחות"><BrandLogo /></NavLink><span>ניהול לקוחות</span><div>{user?.name}<button onClick={logout} aria-label="יציאה"><LogOut size={19} /></button></div></header>
    <aside aria-label="תפריט ניהול"><NavLink to="/summary"><Wallet size={21} />התקציב שלי</NavLink><NavLink to="/admin/clients"><Users size={21} />לקוחות</NavLink><NavLink to="/admin/mail"><Mail size={21} />מיילים ולקוחות</NavLink><NavLink to="/import"><Upload size={21} />העלאת נתונים</NavLink></aside>
    <main>{children}</main>
  </div>;
}
