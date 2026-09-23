import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSecurity } from './SecurityContext';
import { AppSplash } from './AppSplash';

export function AppLockGuard({ children }: { children: ReactNode }) {
  const { loading, isLocked } = useSecurity();
  if (loading) return <AppSplash status="Checking app security…" />;
  if (isLocked) return <Navigate to="/unlock" replace />;
  return children;
}
