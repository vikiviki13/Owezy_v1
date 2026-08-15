import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AlertCircle, CloudOff, Database, LoaderCircle, Wallet } from 'lucide-react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Shell } from './components/Shell';
import { ToastProvider } from './components/Toast';
import { PreferencesProvider } from './components/PreferencesProvider';
import { SecurityProvider } from './components/SecurityProvider';
import { AppLockGuard } from './components/AppLockGuard';
import { LockScreen } from './components/security/LockScreen';
import { Auth } from './pages/Auth';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { Friends } from './pages/Friends';
import { ContactImport } from './pages/ContactImport';
import { FriendDetail } from './pages/FriendDetail';
import { ManageFriend } from './pages/ManageFriend';
import { AddExpense } from './pages/AddExpense';
import { RecordRepayment } from './pages/RecordRepayment';
import { ExpenseDetail } from './pages/ExpenseDetail';
import { Activity } from './pages/Activity';
import { Statement } from './pages/Statement';
import { Groups } from './pages/Groups';
import { Profile } from './pages/Profile';
import { EditProfile } from './pages/settings/EditProfile';
import { AppearanceSettings, CurrencySettings, DateTimeSettings, LanguageSettings } from './pages/settings/PreferencePages';
import { DataStorageSettings, ExportDataSettings, InstallAppSettings, NotificationSettings, PaymentReminderSettings, PrivacySettings } from './pages/settings/AccountSettingsPages';
import { AccountRecoveryPage, AppLockSettings, ChangePinPage, SecurityActivityPage, SecurityDevices, SecuritySettings } from './pages/settings/SecurityPages';
import { AboutSettings, HelpSupport } from './pages/settings/SupportPages';
import { clearCloudRuntimeState, initializeCloudData, LegacyDataChoiceRequired, stopCloudData, type LegacyMigrationDecision } from './lib/cloudData';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { clearSensitiveLocalData } from './lib/db';
import { clearAllLocalSecurityState, clearLocalSecurityState } from './lib/securityService';
import { clearContactImportDraft } from './lib/contactImport';
import { privateDataErrorMessage } from './lib/safeErrors';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [startupError, setStartupError] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let mounted = true;
    let currentUserId: string | null = null;
    async function activate(nextUser: User | null) {
      if (!nextUser) {
        clearCloudRuntimeState();
        if (currentUserId) clearLocalSecurityState(currentUserId);
        clearAllLocalSecurityState();
        clearSensitiveLocalData();
        void clearContactImportDraft();
        currentUserId = null;
        if (mounted) {
          setUser(null);
          setStartupError('');
          setLoading(false);
        }
        return;
      }
      if (currentUserId && currentUserId !== nextUser.id) {
        clearLocalSecurityState(currentUserId);
        clearSensitiveLocalData();
        await clearContactImportDraft();
      }
      currentUserId = nextUser.id;
      if (mounted) { setUser(nextUser); setStartupError(''); setLoading(false); }
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        if (mounted) {
          setStartupError('Your session could not be restored securely. Sign in again.');
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
  return <AuthenticatedApp user={user} />;
}

function AuthenticatedApp({ user }: { user: User }) {
  return (
    <ToastProvider>
      <SecurityProvider userId={user.id}>
        <HashRouter>
          <Routes>
            <Route path="/unlock" element={<LockScreen />} />
            <Route path="/account-recovery" element={<AccountRecoveryPage />} />
            <Route path="*" element={<AppLockGuard><PrivateDataApp user={user} /></AppLockGuard>} />
          </Routes>
        </HashRouter>
      </SecurityProvider>
    </ToastProvider>
  );
}

function PrivateDataApp({ user }: { user: User }) {
  const userId = user.id;
  const onboardingKey = `tab_onboarded_v2_${userId}`;
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem(onboardingKey) === '1');
  const [syncError, setSyncError] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [legacyPending, setLegacyPending] = useState(false);

  useEffect(() => {
    setOnboarded(localStorage.getItem(onboardingKey) === '1');
  }, [onboardingKey]);

  useEffect(() => {
    let active = true;
    setDataLoading(true);
    setDataError('');
    setLegacyPending(false);
    void initializeCloudData(user)
      .catch((caught) => {
        if (!active) return;
        if (caught instanceof LegacyDataChoiceRequired) setLegacyPending(true);
        else setDataError(privateDataErrorMessage(caught));
      })
      .finally(() => { if (active) setDataLoading(false); });
    return () => { active = false; stopCloudData(); };
  }, [user]);

  async function resolveLegacyData(decision: LegacyMigrationDecision) {
    setDataLoading(true);
    setDataError('');
    try {
      await initializeCloudData(user, decision);
      setLegacyPending(false);
    } catch (caught) {
      setDataError(privateDataErrorMessage(caught));
    } finally {
      setDataLoading(false);
    }
  }

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

  if (dataLoading) return <LoadingScreen />;
  if (dataError) return <StartupError message={dataError} />;
  if (legacyPending) {
    return (
      <main className="min-h-screen flex items-center justify-center px-5 bg-[var(--color-bg)]">
        <section className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <Database className="text-[var(--color-primary)]" size={30} />
          <h1 className="text-xl font-bold mt-4">Older data found on this device</h1>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)] mt-2">Import it only if it belongs to the account you just signed into. It will never be attached automatically.</p>
          <div className="rounded-2xl bg-[var(--color-surface-secondary)] p-4 text-xs leading-5 text-[var(--color-text-secondary)] mt-4">Choosing “Start Fresh” removes the unassigned local copy from this browser after a new private account record is created.</div>
          <button type="button" onClick={() => void resolveLegacyData('import')} className="w-full min-h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold mt-5">This Is My Data — Import</button>
          <button type="button" onClick={() => void resolveLegacyData('discard')} className="w-full min-h-12 rounded-xl border border-[var(--color-border)] font-semibold mt-3">Start Fresh</button>
        </section>
      </main>
    );
  }
  if (!onboarded) {
    return (
      <Onboarding onDone={() => {
        localStorage.setItem(onboardingKey, '1');
        setOnboarded(true);
      }} />
    );
  }

  return (
    <>
      {syncError && (
        <div className="fixed top-0 inset-x-0 z-50 bg-[var(--color-error)] text-white text-xs px-4 py-2 flex items-center justify-center gap-2">
          <CloudOff size={14} /> Changes are saved on this device but cloud sync failed.
        </div>
      )}
      <PreferencesProvider>
            <Shell>
            <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/friends/import" element={<ContactImport />} />
            <Route path="/friends/:id" element={<FriendDetail />} />
            <Route path="/friends/:id/manage" element={<ManageFriend />} />
            <Route path="/add-expense" element={<AddExpense />} />
            <Route path="/record-repayment" element={<RecordRepayment />} />
            <Route path="/expense/:id" element={<ExpenseDetail />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/statement/:friendId" element={<Statement />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/edit" element={<EditProfile />} />
            <Route path="/profile/currency" element={<CurrencySettings />} />
            <Route path="/profile/date-time" element={<DateTimeSettings />} />
            <Route path="/profile/appearance" element={<AppearanceSettings />} />
            <Route path="/profile/language" element={<LanguageSettings />} />
            <Route path="/profile/notifications" element={<NotificationSettings />} />
            <Route path="/profile/payment-reminders" element={<PaymentReminderSettings />} />
            <Route path="/profile/security" element={<SecuritySettings />} />
            <Route path="/profile/app-lock" element={<AppLockSettings />} />
            <Route path="/profile/security/devices" element={<SecurityDevices />} />
            <Route path="/profile/security/activity" element={<SecurityActivityPage />} />
            <Route path="/profile/security/change-pin" element={<ChangePinPage />} />
            <Route path="/profile/privacy" element={<PrivacySettings />} />
            <Route path="/profile/data-storage" element={<DataStorageSettings />} />
            <Route path="/profile/export" element={<ExportDataSettings />} />
            <Route path="/profile/install" element={<InstallAppSettings />} />
            <Route path="/profile/help" element={<HelpSupport />} />
            <Route path="/profile/about" element={<AboutSettings />} />
            </Routes>
            </Shell>
      </PreferencesProvider>
    </>
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
