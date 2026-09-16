import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { MaslakaDataProvider } from './hooks/useMaslakaData';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Budgets from './pages/Budgets';
import Categories from './pages/Categories';
import Import from './pages/Import';
import Incomes from './pages/Incomes';
import Login from './pages/Login';
import Register from './pages/Register';
import NetWorth from './pages/NetWorth';
import Assets from './pages/Assets';
import Pension from './pages/Pension';
import Protection from './pages/Protection';
import PreviewBudgets from './pages/PreviewBudgets';
import DashboardV2 from './pages/DashboardV2';
import AdminClients from './pages/AdminClients';
import './index.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (import.meta.env.DEV) return <Layout>{children}</Layout>; // ponytail: בלי login בפיתוח מקומי, לא רץ ב-build של production
  if (loading) return <div className="loading full">טוען...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading full">טוען...</div>;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
    <MaslakaDataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          {/* בלי PublicRoute: אחרי שלב 1 (יצירת חשבון) המשתמש כבר מחובר, אבל עדיין באמצע האשף (שלבים 2-3) - לא רוצים להעיף אותו החוצה */}
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><NetWorth /></ProtectedRoute>} />
          <Route path="/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
          <Route path="/pension" element={<ProtectedRoute><Pension /></ProtectedRoute>} />
          <Route path="/protection" element={<ProtectedRoute><Protection /></ProtectedRoute>} />
          <Route path="/summary" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
          <Route path="/budgets" element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
          <Route path="/import" element={<ProtectedRoute><Import /></ProtectedRoute>} />
          <Route path="/incomes" element={<ProtectedRoute><Incomes /></ProtectedRoute>} />
          <Route path="/admin/clients" element={<ProtectedRoute><AdminClients /></ProtectedRoute>} />
          <Route path="/preview" element={<Layout previewMode><NetWorth /></Layout>} />
          <Route path="/preview/assets" element={<Layout previewMode><Assets previewMode /></Layout>} />
          <Route path="/preview/pension" element={<Layout previewMode><Pension /></Layout>} />
          <Route path="/preview/protection" element={<Layout previewMode><Protection /></Layout>} />
          <Route path="/preview/budgets" element={<Layout previewMode><PreviewBudgets /></Layout>} />
          <Route path="/preview/dashboard-v2" element={<DashboardV2 />} />
        </Routes>
      </BrowserRouter>
    </MaslakaDataProvider>
    </AuthProvider>
  );
}
