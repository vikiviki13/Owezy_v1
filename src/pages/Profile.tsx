import { useEffect, useState } from 'react';
import {
  Bell, CalendarDays, ChevronRight, CircleHelp, Database, Download, Fingerprint,
  Languages, LogOut, Moon, ReceiptText, Share2, ShieldCheck, Smartphone, WalletCards, Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { BottomSheet } from '../components/BottomSheet';
import { SettingsRow, SettingsSection } from '../components/SettingsUI';
import { usePreferences } from '../components/PreferencesContext';
import { useToast } from '../components/ToastContext';
import { clearCloudRuntimeState, flushCloudData } from '../lib/cloudData';
import { clearLegacyLocalData, clearSensitiveLocalData, getProfile, onDBChange } from '../lib/db';
import { currencySymbol, formatDateTime } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';
import { clearAllLocalSecurityState, revokeAllSecuritySessions } from '../lib/securityService';
import { useSecurity } from '../components/SecurityContext';
import { clearContactImportDraft } from '../lib/contactImport';

export function Profile() {
  const [profile, setProfile] = useState(getProfile);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { preferences } = usePreferences();
  const { userId, status } = useSecurity();
  const toast = useToast();

  useEffect(() => onDBChange(() => setProfile({ ...getProfile() })), []);

  async function signOut() {
    setSigningOut(true);
    let remoteFailure = false;
    try {
      try { await flushCloudData(); } catch { toast('Some changes could not be synced.'); }
      try { await revokeAllSecuritySessions(userId); } catch { remoteFailure = true; }
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) remoteFailure = true;
    } finally {
      // Local privacy cleanup must never depend on network or Edge Function
      // availability. A final local-only sign-out removes any residual token.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      clearCloudRuntimeState();
      clearSensitiveLocalData();
      clearLegacyLocalData();
      clearAllLocalSecurityState();
      await clearContactImportDraft(userId);
      if (remoteFailure) toast('Local data was cleared. The server could not confirm every session revocation.');
      window.location.reload();
    }
  }

  const reminderValue = preferences.default_reminder_days === 1 ? '1 day' : `${preferences.default_reminder_days} days`;
  return (
    <div className="px-4 pt-6 pb-10 safe-top">
      <h1 className="text-xl font-semibold mb-5">{t('profile')}</h1>

      <section className="flex items-center gap-4 py-2 mb-7">
        <Avatar name={profile.full_name} src={profile.avatar_url} size={72} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold truncate">{profile.full_name}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] truncate mt-0.5">{profile.email || 'Email not added'}</p>
          {profile.phone && <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{profile.phone}</p>}
          <Link to="/profile/edit" className="inline-flex items-center gap-1 mt-2 text-sm font-semibold text-[var(--color-primary)] min-h-8">{t('editProfile')} <ChevronRight size={15} /></Link>
        </div>
      </section>

      <SettingsSection title={t('preferences')}>
        <SettingsRow icon={WalletCards} title="Currency" value={`${preferences.currency_code} · ${currencySymbol()}`} to="/profile/currency" />
        <SettingsRow icon={CalendarDays} title="Date & Time" value={formatDateTime('2026-08-12', '14:03')} to="/profile/date-time" />
        <SettingsRow icon={Moon} title="Appearance" value={preferences.theme === 'system' ? 'System' : titleCase(preferences.theme)} to="/profile/appearance" />
        <SettingsRow icon={Languages} title="Language" value="English" to="/profile/language" />
      </SettingsSection>

      <SettingsSection title={t('notifications')}>
        <SettingsRow icon={Bell} title="Notifications" value={preferences.notifications_enabled ? 'Enabled' : 'Off'} to="/profile/notifications" />
        <SettingsRow icon={ReceiptText} title="Payment Reminders" value={reminderValue} to="/profile/payment-reminders" />
      </SettingsSection>

      <SettingsSection title={t('securityPrivacy')}>
        <SettingsRow icon={Fingerprint} title="Security" value={status?.appLockEnabled ? 'Protected' : 'Off'} to="/profile/security" />
        <SettingsRow icon={ShieldCheck} title="Privacy" to="/profile/privacy" />
        <SettingsRow icon={Database} title="Data & Storage" to="/profile/data-storage" />
      </SettingsSection>

      <SettingsSection title={t('appData')}>
        <SettingsRow icon={Share2} title="Share App" to="/profile/share" />
        <SettingsRow icon={Smartphone} title="Install App" to="/profile/install" />
        <SettingsRow icon={Download} title="Export Data" to="/profile/export" />
        <SettingsRow icon={CircleHelp} title="Help & Support" to="/profile/help" />
        <SettingsRow icon={Info} title="About" to="/profile/about" />
      </SettingsSection>

      <SettingsSection title={t('account')}>
        <SettingsRow icon={LogOut} title={t('signOut')} onClick={() => setSignOutOpen(true)} danger trailing={false} />
      </SettingsSection>

      <BottomSheet open={signOutOpen} onClose={() => setSignOutOpen(false)} title="Sign out?">
        <p className="text-sm leading-6 text-[var(--color-text-secondary)] mb-5">You'll need to sign in again to access your synced data.</p>
        <div className="flex gap-3">
          <button onClick={() => setSignOutOpen(false)} className="flex-1 min-h-12 rounded-xl bg-[var(--color-surface-secondary)] font-semibold">Cancel</button>
          <button onClick={signOut} disabled={signingOut} className="flex-1 min-h-12 rounded-xl border border-[var(--color-border)] font-semibold text-[var(--color-error)] disabled:opacity-60">{signingOut ? 'Signing out…' : 'Sign Out'}</button>
        </div>
      </BottomSheet>
    </div>
  );
}

function titleCase(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
