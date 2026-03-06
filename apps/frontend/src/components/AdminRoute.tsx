import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../api/client';

export function AdminRoute({ children }: { children: ReactNode }) {
  const { accessToken, isLoading } = useAuth();
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    apiClient
      .get('/admin/stats')
      .then(() => { setIsAdmin(true); setAdminChecked(true); })
      .catch(() => { setIsAdmin(false); setAdminChecked(true); });
  }, [accessToken]);

  if (isLoading || (accessToken && !adminChecked)) {
    return <div style={{ color: '#e0d7ff', padding: '2rem' }}>Loading...</div>;
  }
  if (!accessToken) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
