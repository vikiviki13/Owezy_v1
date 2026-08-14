import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AlertCircle, CloudOff, LoaderCircle, Wallet } from 'lucide-react';
import { HashRouter, Navigate, Routes, Route } from 'react-router-dom';
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
import { FriendDetail } from './pages/FriendDetail';
import { ClearFriendData, EditFriend, ManageFriend } from './pages/ManageFriend';
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
import { clearCloudRuntimeState, initializeCloudData, stopCloudData } from './lib/cloudData';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { clearSensitiveLocalData, updateProfile } from './lib/db';
import { clearLocalSecurityState } from './lib/securityService';
import {
  completeOnboarding,
  getOnboardingProfile,
  onboardingDestination,
  type OnboardingProfile,
} from './lib/onboardingProfile';

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
        if (currentUserId) {
          clearLocalSecurityState(currentUserId);
          clearSensitiveLocalData();
        }
        currentUserId = null;
        if (mounted) {
          setUser(null);
          setStartupError('');
          setLoading(false);
        }
        return;
      }
      currentUserId = nextUser.id;
      if (mounted) { setUser(nextUser); setStartupError(''); setLoading(false); }
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
  return <AuthenticatedApp user={user} />;
}

function AuthenticatedApp({ user }: { user: User }) {
  const [onboardingProfile, setOnboardingProfile] = useState<OnboardingProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    let active = true;
    setProfileLoading(true);
    setProfileError('');
    setOnboardingProfile(null);
    void getOnboardingProfile(user.id)
      .then((profile) => { if (active) setOnboardingProfile(profile); })
      .catch((caught) => {
        if (active) setProfileError(caught instanceof Error ? caught.message : 'Could not load your profile.');
      })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [user.id]);

  const finishOnboarding = useCallback(async (name: string) => {
    updateProfile({ full_name: name.trim() || 'You', default_currency: 'INR' });
    const profile = await completeOnboarding(user.id);
    setOnboardingProfile(profile);
  }, [user.id]);

  return (
    <ToastProvider>
      <SecurityProvider userId={user.id}>
        <HashRouter>
          <Routes>
            <Route path="/unlock" element={<LockScreen />} />
            <Route path="/account-recovery" element={<AccountRecoveryPage />} />
            <Route path="*" element={<AppLockGuard><PrivateDataApp user={user} onboardingProfile={onboardingProfile} profileLoading={profileLoading} profileError={profileError} onFinishOnboarding={finishOnboarding} /></AppLockGuard>} />
          </Routes>
        </HashRouter>
      </SecurityProvider>
    </ToastProvider>
  );
}

function PrivateDataApp({
  user,
  onboardingProfile,
  profileLoading,
  profileError,
  onFinishOnboarding,
}: {
  user: User;
  onboardingProfile: OnboardingProfile | null;
  profileLoading: boolean;
  profileError: string;
  onFinishOnboarding: (name: string) => Promise<void>;
}) {
  const [syncError, setSyncError] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState('');

  useEffect(() => {
    let active = true;
    setDataLoading(true);
    void initializeCloudData(user)
      .catch((caught) => { if (active) setDataError(caught instanceof Error ? caught.message : 'Could not load your cloud data.'); })
      .finally(() => { if (active) setDataLoading(false); });
    return () => { active = false; stopCloudData(); };
  }, [user]);

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

  if (dataLoading || profileLoading) return <LoadingScreen />;
  if (profileError) return <StartupError message={profileError} />;
  if (dataError) return <StartupError message={dataError} />;
  if (!onboardingProfile) return <StartupError message="Your profile could not be loaded." />;
  if (!onboardingProfile.onboardingCompleted) {
    return <Routes>
      <Route path="/onboarding" element={<Onboarding onDone={onFinishOnboarding} />} />
      <Route path="*" element={<Navigate to="/onboarding" replace />} />
    </Routes>;
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
            <Route path="/" element={<Navigate to={onboardingDestination(true)} replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/onboarding" element={<Navigate to="/home" replace />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/friends/:id" element={<FriendDetail />} />
            <Route path="/friends/:id/manage" element={<ManageFriend />} />
            <Route path="/friends/:id/edit" element={<EditFriend />} />
            <Route path="/friends/:id/clear-data" element={<ClearFriendData />} />
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
            <Route path="*" element={<Navigate to="/home" replace />} />
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
