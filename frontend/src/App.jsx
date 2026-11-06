import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { MaslakaDataProvider } from './hooks/useMaslakaData';
import { SandboxProvider } from './hooks/useSandboxData';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import BudgetWorkspace from './pages/BudgetWorkspace';
import Expenses from './pages/Expenses';
import Budgets from './pages/Budgets';
import Categories from './pages/Categories';
import Import from './pages/Import';
import Incomes from './pages/Incomes';
import Login from './pages/Login';
import Register from './pages/Register';
import NetWorth from './pages/NetWorth';
import ClientPortal from './pages/ClientPortal';
import Assets from './pages/Assets';
import Pension from './pages/Pension';
import Protection from './pages/Protection';
import PreviewBudgets from './pages/PreviewBudgets';
import DashboardV2 from './pages/DashboardV2';
import AdminClients from './pages/AdminClients';
import AdminMail from './pages/AdminMail';
import AdminClientDetail from './pages/AdminClientDetail';
import ParserTest from './pages/ParserTest';
import './index.css';
import {lazy,Suspense} from 'react';
const StagingCrm=import.meta.env.VITE_APP_ENV==='staging'?lazy(()=>import('./pages/StagingCrm')):null;
const OperationalCrm=import.meta.env.VITE_OPERATIONAL_CRM==='true'&&!StagingCrm?lazy(()=>import('./pages/OperationalCrm')):null;
function OperationalCrmRoute(){const {user,loading}=useAuth();if(loading)return <p>טוען…</p>;if(!user)return <Navigate to="/login" replace/>;if(!import.meta.env.VITE_ADMIN_EMAIL||user.email!==import.meta.env.VITE_ADMIN_EMAIL)return <Navigate to="/" replace/>;return <Suspense fallback={<p>טוען מעקב…</p>}><OperationalCrm/></Suspense>;}
function StagingCrmRoute(){const {user,loading}=useAuth();if(loading)return <p>טוען…</p>;if(!user)return <Navigate to="/login" replace/>;if(user.email!==import.meta.env.VITE_ADMIN_EMAIL)return <Navigate to="/" replace/>;return <Suspense fallback={<p>טוען CRM…</p>}><StagingCrm/></Suspense>;}

function ProtectedRoute({ children, layoutProps }) {
  const { user, loading } = useAuth();
  if (import.meta.env.DEV) return <Layout {...layoutProps}>{children}</Layout>; // ponytail: בלי login בפיתוח מקומי, לא רץ ב-build של production
  if (loading) return <div className="app-loading full" role="status">טוען...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.email === import.meta.env.VITE_ADMIN_EMAIL && !layoutProps?.sandboxMode) return <AdminLayout>{children}</AdminLayout>;
  return <Layout {...layoutProps}>{children}</Layout>;
}

function GmailAdminRoute() {
  const { user, loading } = useAuth();
  if (loading) return <p role="status">טוען...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!import.meta.env.VITE_ADMIN_EMAIL || user.email !== import.meta.env.VITE_ADMIN_EMAIL) return <Navigate to="/" replace />;
  return <AdminLayout><AdminMail /></AdminLayout>;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading full" role="status">טוען...</div>;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function StagingBanner(){const {pathname}=useLocation();if(pathname==='/admin/crm')return null;return (import.meta.env.VITE_APP_ENV==='staging'&&<div dir="rtl" style={{background:'#fff1cc',padding:12,position:'sticky',top:0,zIndex:20000,textAlign:'center'}}>STAGING · נתוני בדיקה בלבד · יומן בדיקות בחיבור מאושר · מייל בדיקה לנמען קבוע בלבד · <a href="/__staging">בחירת חשבון בדיקה</a> · <a href="/admin/crm">CRM</a> · <a href="/admin/clients">אדמין</a> · <a href="/budget">התקציב שלי</a></div>);}

export default function App() {
  return (
    <AuthProvider>
    <SandboxProvider>
    <MaslakaDataProvider>
      <BrowserRouter>
        <StagingBanner/>
        <Routes>
          {StagingCrm&&<Route path="/admin/crm" element={<StagingCrmRoute/>}/>}
          {OperationalCrm&&<Route path="/admin/crm" element={<OperationalCrmRoute/>}/>}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          {/* בלי PublicRoute: אחרי שלב 1 (יצירת חשבון) המשתמש כבר מחובר, אבל עדיין באמצע האשף (שלבים 2-3) - לא רוצים להעיף אותו החוצה */}
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ClientPortal />} />
          <Route path="/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
          <Route path="/pension" element={<ProtectedRoute><Pension /></ProtectedRoute>} />
          <Route path="/protection" element={<ProtectedRoute><Protection /></ProtectedRoute>} />
          <Route path="/summary" element={<ProtectedRoute><BudgetWorkspace /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
          <Route path="/budget" element={<ProtectedRoute><BudgetWorkspace /></ProtectedRoute>} />
          <Route path="/budgets" element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
          <Route path="/import" element={<ProtectedRoute><Import /></ProtectedRoute>} />
          <Route path="/incomes" element={<ProtectedRoute><Incomes /></ProtectedRoute>} />
          <Route path="/admin/clients" element={<ProtectedRoute><AdminClients /></ProtectedRoute>} />
          <Route path="/admin/mail" element={<GmailAdminRoute />} />
          <Route path="/admin/clients/:id/dashboard" element={<ClientPortal />} />
          <Route path="/admin/clients/:id" element={<ProtectedRoute><AdminClientDetail /></ProtectedRoute>} />
          <Route path="/admin/parser-test" element={<ProtectedRoute><ParserTest /></ProtectedRoute>} />
          <Route path="/admin/parser-test/networth" element={<ProtectedRoute layoutProps={{ sandboxMode: true }}><NetWorth /></ProtectedRoute>} />
          <Route path="/admin/parser-test/pension" element={<ProtectedRoute layoutProps={{ sandboxMode: true }}><Pension /></ProtectedRoute>} />
          <Route path="/admin/parser-test/protection" element={<ProtectedRoute layoutProps={{ sandboxMode: true }}><Protection /></ProtectedRoute>} />
          <Route path="/preview" element={<Layout previewMode><NetWorth /></Layout>} />
          <Route path="/preview/assets" element={<Layout previewMode><Assets previewMode /></Layout>} />
          <Route path="/preview/pension" element={<Layout previewMode><Pension /></Layout>} />
          <Route path="/preview/protection" element={<Layout previewMode><Protection /></Layout>} />
          <Route path="/preview/budgets" element={<Layout previewMode><PreviewBudgets /></Layout>} />
          <Route path="/preview/dashboard-v2" element={<DashboardV2 />} />
        </Routes>
      </BrowserRouter>
    </MaslakaDataProvider>
    </SandboxProvider>
    </AuthProvider>
  );
}
