import { useEffect, useState } from 'react';
import { Navigate, Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../api/client';
import SandboxApp from '../sandbox/SandboxApp';

export default function ClientPortal() {
  const { user, loading, logout } = useAuth();
  const { id } = useParams();
  const isAdminPreview = Boolean(id);
  const allowed = !isAdminPreview || (Boolean(import.meta.env.VITE_ADMIN_EMAIL) && user?.email === import.meta.env.VITE_ADMIN_EMAIL);
  const targetId = id || user?.id;
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setAttempt(n => n + 1); };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);
  useEffect(() => {
    if (!user || !allowed || (!id && user.email === import.meta.env.VITE_ADMIN_EMAIL)) return;
    const controller = new AbortController();
    Promise.all([
      api.get(isAdminPreview ? `/admin/clients/${id}/financial-data` : '/client-profile/financial-data', { signal: controller.signal }),
      api.get(isAdminPreview ? `/admin/clients/${id}` : '/client-profile', { signal: controller.signal }),
    ]).then(([financial, profile]) => {
      if (controller.signal.aborted) return;
      setResult({ userId: user.id, targetId, version: JSON.stringify(financial.data), snapshot: {
        ...(financial.data || {}), source: 'production',
        profile: { name: isAdminPreview ? profile.data?.name : user.name, email: isAdminPreview ? profile.data?.email : user.email, phone: profile.data?.phone,
          birth_date: profile.data?.birth_date, monthly_income: profile.data?.monthly_income,
          status: profile.data?.status }, displayName: isAdminPreview ? profile.data?.name : user.name,
      } });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ userId: user.id, targetId, error: true });
    });
    return () => controller.abort();
  }, [user, attempt, id, isAdminPreview, allowed, targetId]);
  if (loading) return <div className="app-loading full" role="status">טוען…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!id && user.email === import.meta.env.VITE_ADMIN_EMAIL) return <Navigate to="/admin/clients" replace />;
  if (!allowed) return <Navigate to="/" replace />;
  if (result?.userId !== user.id || result?.targetId !== targetId) return <div className="app-loading full" role="status">טוען את התיק שלך…</div>;
  if (result.error) return <div className="auth-page"><section className="auth-card" role="alert"><h2>לא הצלחנו לטעון את התיק</h2><button onClick={() => { setResult(null); setAttempt(n => n + 1); }}>ניסיון נוסף</button><button onClick={logout}>יציאה</button></section></div>;
  return <>{isAdminPreview && <div style={{ position: 'fixed', bottom: 12, left: 12, zIndex: 10000, background: '#214c3f', color: '#fff', borderRadius: 12, padding: '10px 16px' }}>תצוגת לקוח: {result.snapshot.displayName} · <Link style={{ color: '#fff' }} to={`/admin/clients/${id}`}>חזרה לניהול התיק</Link></div>}<SandboxApp key={`${user.id}:${targetId}:${result.version}`} clientMode initialSnapshot={result.snapshot} onSignOut={logout} /></>;
}
