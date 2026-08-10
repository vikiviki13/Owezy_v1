import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AlertCircle, CloudOff, LoaderCircle, Wallet } from 'lucide-react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Shell } from './components/Shell';
import { ToastProvider } from './components/Toast';
import { Auth } from './pages/Auth';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { Friends } from './pages/Friends';
import { FriendDetail } from './pages/FriendDetail';
import { AddExpense } from './pages/AddExpense';
import { RecordRepayment } from './pages/RecordRepayment';
import { ExpenseDetail } from './pages/ExpenseDetail';
import { Activity } from './pages/Activity';
import { Statement } from './pages/Statement';
import { Groups } from './pages/Groups';
import { Profile } from './pages/Profile';
import { initializeCloudData, stopCloudData } from './lib/cloudData';
import { isSupabaseConfigured, supabase } from './lib/supabase';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [startupError, setStartupError] = useState('');

  useEffect(() => {
    const theme = localStorage.getItem('tab_theme');
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else if (!theme) document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let mounted = true;
    let currentUserId: string | null = null;

    async function activate(nextUser: User | null) {
      if (!nextUser) {
        currentUserId = null;
        stopCloudData();
        if (mounted) {
          setUser(null);
          setStartupError('');
          setLoading(false);
        }
        return;
      }
      if (currentUserId === nextUser.id) return;
      currentUserId = nextUser.id;
      if (mounted) {
        setLoading(true);
        setStartupError('');
      }
      try {
        await initializeCloudData(nextUser);
        if (mounted && currentUserId === nextUser.id) setUser(nextUser);
      } catch (caught) {
        currentUserId = null;
        if (mounted) setStartupError(caught instanceof Error ? caught.message : 'Could not load your cloud data.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        if (mounted) {
          setStartupError(error.message);
          setLoading(false);
        }
        return;
      }
      void activate(data.session?.user || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void activate(session?.user || null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      stopCloudData();
    };
  }, []);

  if (!isSupabaseConfigured) return <ConfigurationRequired />;
  if (loading) return <LoadingScreen />;
  if (startupError) return <StartupError message={startupError} />;
  if (!user) return <Auth />;
  return <AuthenticatedApp userId={user.id} />;
}

function AuthenticatedApp({ userId }: { userId: string }) {
  const onboardingKey = `tab_onboarded_v2_${userId}`;
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(onboardingKey) === '1');
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    const failed = (event: Event) => setSyncError((event as CustomEvent<string>).detail || 'Cloud sync failed.');
    const synced = () => setSyncError('');
    window.addEventListener('tab-cloud-sync-error', failed);
    window.addEventListener('tab-cloud-synced', synced);
    return () => {
      window.removeEventListener('tab-cloud-sync-error', failed);
      window.removeEventListener('tab-cloud-synced', synced);
    };
  }, []);

  if (!onboarded) {
    return (
      <ToastProvider>
        <Onboarding onDone={() => {
          localStorage.setItem(onboardingKey, '1');
          setOnboarded(true);
        }} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      {syncError && (
        <div className="fixed top-0 inset-x-0 z-50 bg-[var(--color-error)] text-white text-xs px-4 py-2 flex items-center justify-center gap-2">
          <CloudOff size={14} /> Changes are saved on this device but cloud sync failed.
        </div>
      )}
      <HashRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/friends/:id" element={<FriendDetail />} />
            <Route path="/add-expense" element={<AddExpense />} />
            <Route path="/record-repayment" element={<RecordRepayment />} />
            <Route path="/expense/:id" element={<ExpenseDetail />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/statement/:friendId" element={<Statement />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </Shell>
      </HashRouter>
    </ToastProvider>
  );
}

function LoadingScreen() {
  return <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-[var(--color-text-secondary)]"><LoaderCircle className="animate-spin text-[var(--color-primary)]" /><p className="text-sm">Loading your account…</p></div>;
}

function ConfigurationRequired() {
  return (
    <main className="min-h-screen flex items-center justify-center px-5">
      <div className="max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 text-center">
        <Wallet size={32} className="text-[var(--color-primary)] mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2">Supabase setup required</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your environment. See DEPLOYMENT.md for the complete setup.</p>
      </div>
    </main>
  );
}

function StartupError({ message }: { message: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-5">
      <div className="max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 text-center">
        <AlertCircle size={32} className="text-[var(--color-error)] mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2">Could not open your data</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">{message}</p>
        <p className="text-xs text-[var(--color-text-muted)]">Check your environment variables and run supabase/schema.sql in the Supabase SQL Editor.</p>
      </div>
    </main>
  );
}
