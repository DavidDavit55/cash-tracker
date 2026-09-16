import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Receipt, TrendingUp, Menu, X, Target, Tag, Upload, LogOut, Wallet, Shield, PiggyBank, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { computeNetWorth } from '../mockData';

export default function Layout({ children, previewMode }) {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const p = (path) => previewMode ? `/preview${path === '/' ? '' : path}` : path; // ponytail: temp mockup-only routing, remove with previewMode

  const go = (path) => { setDrawerOpen(false); navigate(path); };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo.png" alt="לוגו" style={{ height: '32px', objectFit: 'contain' }} />
          <span className="app-title">NETWORTH</span>
        </div>
        <button className="icon-btn" onClick={() => setDrawerOpen(true)} title="תפריט"><Menu size={22}/></button>
      </header>

      <main className="app-main">{children}</main>

      <nav className="bottom-nav nav-circles">
        <NavLink to={p('/pension')} className={({ isActive }) => isActive ? 'nav-circle active' : 'nav-circle'}>
          <PiggyBank size={20}/>
          <span>גמל ופנסיה</span>
        </NavLink>
        <NavLink to={p('/assets')} className={({ isActive }) => isActive ? 'nav-circle active' : 'nav-circle'}>
          <Wallet size={20}/>
          <span>עו"ש וחיסכון</span>
        </NavLink>
        <NavLink to={p('/')} end className={({ isActive }) => isActive ? 'nav-circle nav-circle-main active' : 'nav-circle nav-circle-main'}>
          <span className="nav-circle-main-amount" style={{ direction: 'ltr' }}>₪{Math.round(computeNetWorth().netWorth / 1000)}K</span>
          <span>כמה אני שווה</span>
        </NavLink>
        <NavLink to={p('/budgets')} className={({ isActive }) => isActive ? 'nav-circle active' : 'nav-circle'}>
          <Target size={20}/>
          <span>תקציב</span>
        </NavLink>
        <NavLink to={p('/protection')} className={({ isActive }) => isActive ? 'nav-circle active' : 'nav-circle'}>
          <Shield size={20}/>
          <span>הגנות</span>
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
            <button className="drawer-item" onClick={() => go('/summary')}>
              <LayoutDashboard size={20}/> סיכום חודשי
            </button>
            {user?.email === import.meta.env.VITE_ADMIN_EMAIL && (
              <button className="drawer-item" onClick={() => go('/admin/clients')}>
                <Users size={20}/> לקוחות (מנהל)
              </button>
            )}
            <button className="drawer-item" onClick={() => go('/incomes')}>
              <TrendingUp size={20}/> הכנסות
            </button>
            <button className="drawer-item" onClick={() => go('/expenses')}>
              <Receipt size={20}/> הוצאות
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
