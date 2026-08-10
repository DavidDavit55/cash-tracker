import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Receipt, TrendingUp, Menu, X, Target, Tag, Upload, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

  const go = (path) => { setDrawerOpen(false); navigate(path); };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo.png" alt="לוגו" style={{ height: '32px', objectFit: 'contain' }} />
          <span className="app-title">ניהול משק בית</span>
        </div>
        <button className="icon-btn" onClick={() => setDrawerOpen(true)} title="תפריט"><Menu size={22}/></button>
      </header>

      <main className="app-main">{children}</main>

      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <LayoutDashboard size={22}/>
          <span>סיכום</span>
        </NavLink>
        <NavLink to="/incomes" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <TrendingUp size={22}/>
          <span>הכנסות</span>
        </NavLink>
        <NavLink to="/expenses" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <Receipt size={22}/>
          <span>הוצאות</span>
        </NavLink>
      </nav>

      {/* Drawer */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-handle"></div>
            <div className="drawer-header">
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>תפריט</span>
              <button className="icon-btn" onClick={() => setDrawerOpen(false)}><X size={20}/></button>
            </div>
            <button className="drawer-item" onClick={() => go('/budgets')}>
              <Target size={20}/> תקציב
            </button>
            <button className="drawer-item" onClick={() => go('/categories')}>
              <Tag size={20}/> קטגוריות
            </button>
            <button className="drawer-item" onClick={() => go('/import')}>
              <Upload size={20}/> ייבוא
            </button>
            <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '8px', paddingTop: '8px' }}>
              <button className="drawer-item" style={{ color: '#ef4444' }} onClick={() => { setDrawerOpen(false); logout(); }}>
                <LogOut size={20}/> התנתק
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
