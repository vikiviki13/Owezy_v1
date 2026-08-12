import type { ReactNode } from 'react';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useSecurity } from './SecurityContext';

export function AppLockGuard({ children }: { children: ReactNode }) {
  const { loading, isLocked } = useSecurity();
  if (loading) {
    return <main className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[var(--color-bg)] text-[var(--color-text-secondary)]"><ShieldCheck className="text-[var(--color-primary)]" /><LoaderCircle className="animate-spin" size={19} /><p className="text-sm">Checking app security…</p></main>;
  }
  if (isLocked) return <Navigate to="/unlock" replace />;
  return children;
}
