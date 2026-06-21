import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, Target, Tag, LogOut, Upload, TrendingUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Layout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-layout">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo.png" alt="לוגו" style={{ height: '32px', objectFit: 'contain' }} />
          <span className="app-title">ניהול משק בית</span>
        </div>
        <button className="icon-btn" onClick={logout} title="התנתק"><LogOut size={18}/></button>
      </header>
      <main className="app-main">{children}</main>
      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <LayoutDashboard size={22}/>
          <span>סיכום</span>
        </NavLink>
        <NavLink to="/expenses" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <Receipt size={22}/>
          <span>הוצאות</span>
        </NavLink>
        <NavLink to="/budgets" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <Target size={22}/>
          <span>תקציב</span>
        </NavLink>
        <NavLink to="/categories" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <Tag size={22}/>
          <span>קטגוריות</span>
        </NavLink>
        <NavLink to="/incomes" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <TrendingUp size={22}/>
          <span>הכנסות</span>
        </NavLink>
        <NavLink to="/import" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <Upload size={22}/>
          <span>ייבוא</span>
        </NavLink>
      </nav>
    </div>
  );
}
