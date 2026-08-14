import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, Check, ChevronRight, ContactRound, Database, Download, FileJson, FileSpreadsheet, HardDrive, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { ChoiceRow, SettingsPage, SettingsRow, SettingsSection, ToggleRow } from '../../components/SettingsUI';
import { usePreferences } from '../../components/PreferencesContext';
import { useToast } from '../../components/ToastContext';
import { useSecurity } from '../../components/SecurityContext';
import { RequireReauthentication } from '../../components/security/RequireReauthentication';
import { getExportData, getStorageSummary } from '../../lib/db';
import { getInstallPrompt, isStandalone, subscribeInstallPrompt } from '../../lib/install';
import { recordVerifiedExport } from '../../lib/securityService';
import { APP_NAME } from '../../components/Brand';
import { clearContactCache, contactAvailability, getLocalContacts } from '../../lib/contactService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { PermissionBlockedDialog, PermissionExplanationDialog } from '../../components/permissions/PermissionUI';
import { notificationPermissionState, requestNotificationAccess } from '../../lib/permissionService';
import { Button } from '../../components/ui/button';

export function NotificationSettings() {
  const { preferences, updatePreferences } = usePreferences();
  const [draft, setDraft] = useState({
    notifications_enabled: preferences.notifications_enabled,
    payment_reminders_enabled: preferences.payment_reminders_enabled,
    pending_balance_reminders_enabled: preferences.pending_balance_reminders_enabled,
    app_updates_enabled: preferences.app_updates_enabled,
  });
  const toast = useToast();
  const [permission, setPermission] = useState(notificationPermissionState);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    const syncPermission = () => {
      const next = notificationPermissionState();
      setPermission(next);
      if (next === 'blocked' || next === 'unsupported') setDraft((value) => ({ ...value, notifications_enabled: false }));
    };
    window.addEventListener('focus', syncPermission);
    document.addEventListener('visibilitychange', syncPermission);
    return () => {
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
    };
  }, []);

  function explainNotifications() {
    if (permission === 'unsupported') { toast('Notifications are not supported by this browser'); return; }
    if (permission === 'blocked') { setBlockedOpen(true); return; }
    if (permission === 'allowed') { setDraft((value) => ({ ...value, notifications_enabled: true })); return; }
    setExplanationOpen(true);
  }

  async function enableBrowserNotifications() {
    setRequesting(true);
    try {
      const next = await requestNotificationAccess();
      setPermission(next);
      setExplanationOpen(false);
      if (next === 'allowed') {
        setDraft((value) => ({ ...value, notifications_enabled: true }));
        toast('Notifications enabled');
      } else if (next === 'blocked') {
        setDraft((value) => ({ ...value, notifications_enabled: false }));
        setBlockedOpen(true);
      }
    } catch (caught) {
      setExplanationOpen(false);
      const next = notificationPermissionState();
      setPermission(next);
      if (next === 'blocked') setBlockedOpen(true);
      else toast(caught instanceof Error ? caught.message : 'Notification permission could not be requested');
    } finally {
      setRequesting(false);
    }
  }
  function save() { updatePreferences(draft); toast('Notification preferences updated'); }

  return <SettingsPage title="Notifications" description="Control the reminders and important updates you receive.">
    {permission === 'blocked' && <div className="mb-6 rounded-2xl border border-destructive/20 bg-destructive/10 p-4"><div className="flex gap-3"><BellOff className="shrink-0 text-destructive" size={20} /><div><p className="font-semibold text-sm">Notifications are blocked in your browser</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Enable notifications from your browser or device settings, then return here.</p><Button variant="link" className="mt-1 h-9 px-0 text-destructive" onClick={() => setBlockedOpen(true)}>How to Enable</Button></div></div></div>}
    {permission === 'not_requested' && <Button variant="secondary" onClick={explainNotifications} className="mb-6 w-full"><Bell />Enable Notifications</Button>}
    <SettingsSection title="Notifications"><ToggleRow title="Allow Notifications" checked={draft.notifications_enabled && permission === 'allowed'} onChange={(checked) => checked ? explainNotifications() : setDraft((value) => ({ ...value, notifications_enabled: false }))} /></SettingsSection>
    <SettingsSection title="Categories">
      <ToggleRow title="Payment Reminders" description="Notify me when I schedule a reminder for a friend." checked={draft.payment_reminders_enabled} onChange={(checked) => setDraft((value) => ({ ...value, payment_reminders_enabled: checked }))} />
      <ToggleRow title="Pending Balance Reminders" description="Remind me about long-pending balances." checked={draft.pending_balance_reminders_enabled} onChange={(checked) => setDraft((value) => ({ ...value, pending_balance_reminders_enabled: checked }))} />
      <ToggleRow title="App Updates" description="Important product information. Marketing is off by default." checked={draft.app_updates_enabled} onChange={(checked) => setDraft((value) => ({ ...value, app_updates_enabled: checked }))} />
    </SettingsSection>
    <Button onClick={save} className="w-full">Save Preferences</Button>
    <PermissionExplanationDialog
      open={explanationOpen}
      onOpenChange={setExplanationOpen}
      icon={Bell}
      title="Stay Updated"
      description="Allow notifications for payment reminders, pending balances and important app updates."
      primaryLabel="Enable Notifications"
      busy={requesting}
      onContinue={() => void enableBrowserNotifications()}
    />
    <PermissionBlockedDialog open={blockedOpen} onOpenChange={setBlockedOpen} permissionName="Notifications" />
  </SettingsPage>;
}

export function PaymentReminderSettings() {
  const { preferences, updatePreferences } = usePreferences();
  const [days, setDays] = useState(preferences.default_reminder_days);
  const [custom, setCustom] = useState(preferences.default_reminder_days > 7 ? String(preferences.default_reminder_days) : '14');
  const [time, setTime] = useState(preferences.default_reminder_time);
  const toast = useToast();
  function save() { updatePreferences({ default_reminder_days: days, default_reminder_time: time }); toast('Reminder preferences updated'); }
  return <SettingsPage title="Payment Reminders" description={`Choose when ${APP_NAME} should remind you to follow up. Messages to friends are never sent automatically.`}>
    <SettingsSection title="Default Reminder Timing">{[1, 3, 7].map((value) => <ChoiceRow key={value} selected={days === value} title={`${value} day${value === 1 ? '' : 's'}`} onClick={() => setDays(value)} />)}<ChoiceRow selected={![1, 3, 7].includes(days)} title="Custom" description={![1, 3, 7].includes(days) ? `${days} days` : undefined} onClick={() => setDays(Math.max(1, Number(custom) || 14))} /></SettingsSection>
    {![1, 3, 7].includes(days) && <label className="block mb-6"><span className="block text-sm font-semibold mb-2">Custom days</span><input type="number" min="1" max="365" className="input min-h-12" value={custom} onChange={(e) => { setCustom(e.target.value); setDays(Math.max(1, Math.min(365, Number(e.target.value) || 1))); }} /></label>}
    <label className="block mb-7"><span className="block text-sm font-semibold mb-2">Reminder time</span><input type="time" className="input min-h-12" value={time} onChange={(e) => setTime(e.target.value)} /></label>
    <div className="rounded-2xl bg-[var(--color-surface-secondary)] p-4 mb-7 text-xs leading-5 text-[var(--color-text-secondary)]">Reminders notify you—the app owner—to take action. WhatsApp sharing always requires you to tap and send.</div>
    <button onClick={save} className="w-full min-h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold">Save Reminder Settings</button>
  </SettingsPage>;
}

export function PrivacySettings() {
  return <SettingsPage title="Privacy" description={`Permissions are requested only when a feature needs them. ${APP_NAME} does not request unnecessary access during onboarding.`}>
    <SettingsSection title="Device Access">
      <SettingsRow icon={ShieldCheck} title="App Permissions" description={`See what ${APP_NAME} can access and manage permission status on this device.`} to="/profile/privacy/permissions" />
    </SettingsSection>
    <SettingsSection title="Contacts">
      <SettingsRow icon={ContactRound} title="Local Contacts" description="Manage contact information stored only on this device." to="/profile/privacy/contacts" />
    </SettingsSection>
  </SettingsPage>;
}

export function ContactPrivacySettings() {
  const toast = useToast();
  const [contactCount, setContactCount] = useState<number>();
  const [clearConfirmationOpen, setClearConfirmationOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let active = true;
    void getLocalContacts()
      .then((contacts) => { if (active) setContactCount(contacts.length); })
      .catch(() => { if (active) setContactCount(0); });
    return () => { active = false; };
  }, []);

  async function clearLocalContacts() {
    setClearing(true);
    try {
      await clearContactCache();
      setContactCount(0);
      setClearConfirmationOpen(false);
      toast('Local contact cache cleared. Your friends were not deleted.');
    } catch {
      toast('Local contact cache could not be cleared on this device.');
    } finally {
      setClearing(false);
    }
  }

  const contactState = contactAvailability();
  const contactStateLabel = contactState === 'available_on_demand' ? 'Available on demand' : contactState === 'not_available' ? 'Not available' : 'Not supported';
  return <SettingsPage title="Contacts" description={`${APP_NAME} uses your device contacts only to help you find and add friends. Contact information stays on your device unless you explicitly add someone as a friend.`}>
    <SettingsSection title="Contact Access">
      <SettingsRow icon={ContactRound} title="Contact Access" description="Requested only after you tap Import from Contacts." value={contactStateLabel} trailing={false} />
      <SettingsRow icon={HardDrive} title="Local Contacts Cache" description="Only contacts you previously chose are searchable offline." value={contactCount === undefined ? 'Loading…' : `${contactCount} contact${contactCount === 1 ? '' : 's'}`} trailing={false} />
    </SettingsSection>
    <SettingsSection title="Local Data">
      <SettingsRow icon={Trash2} title="Clear Local Contact Cache" description="Remove imported contact information stored only on this device." onClick={() => setClearConfirmationOpen(true)} danger disabled={!contactCount} trailing={false} />
    </SettingsSection>
    <p className="rounded-2xl bg-secondary p-4 text-xs leading-5 text-muted-foreground">Friends you've already added won't be deleted. Clearing this cache does not affect expenses, repayments, or other financial history.</p>
    <AlertDialog open={clearConfirmationOpen} onOpenChange={setClearConfirmationOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear local contact cache?</AlertDialogTitle>
          <AlertDialogDescription>This removes imported contact information stored on this device. Friends you've already added won't be deleted.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={clearing} onClick={(event) => { event.preventDefault(); void clearLocalContacts(); }}>{clearing ? 'Clearing…' : 'Clear Local Contact Cache'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </SettingsPage>;
}

export function DataStorageSettings() {
  const [summary] = useState(getStorageSummary);
  const toast = useToast();
  const size = summary.bytes < 1024 * 1024 ? `${(summary.bytes / 1024).toFixed(1)} KB` : `${(summary.bytes / 1024 / 1024).toFixed(1)} MB`;
  async function clearCache() {
    if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map((key) => caches.delete(key))); }
    toast('Cached data cleared. Your financial records are safe.');
  }
  return <SettingsPage title="Data & Storage" description="See what is stored on this device and safely manage temporary files.">
    <div className="grid grid-cols-2 gap-3 mb-7"><InfoCard icon={Database} label="Stored Receipts" value={`${summary.receiptCount} receipts`} /><InfoCard icon={HardDrive} label="Storage Used" value={size} /></div>
    <SettingsSection title="Attachments"><button onClick={() => toast(summary.receiptCount ? 'Attachment manager opened' : 'No stored attachments to manage')} className="w-full min-h-14 px-4 flex items-center gap-3 text-left"><Download size={18} /><span className="flex-1 font-medium text-sm">Manage Attachments</span><ChevronRight size={17} className="text-[var(--color-text-muted)]" /></button></SettingsSection>
    <SettingsSection title="Cache"><button onClick={clearCache} className="w-full min-h-14 px-4 flex items-center gap-3 text-left"><Trash2 size={18} /><span className="flex-1"><span className="block font-medium text-sm">Clear Cached Data</span><span className="block text-xs text-[var(--color-text-muted)] mt-1">Removes temporary app files only</span></span></button></SettingsSection>
    <div className="rounded-2xl bg-[var(--color-surface-secondary)] p-4 text-xs leading-5 text-[var(--color-text-secondary)]"><strong className="text-[var(--color-text-primary)]">Cache is not user data.</strong> Clearing cache never deletes friends, expenses, repayments, groups, or account information.</div>
  </SettingsPage>;
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: string }) { return <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4"><Icon size={20} className="text-[var(--color-primary)] mb-4" /><p className="text-xs text-[var(--color-text-muted)]">{label}</p><p className="font-bold mt-1">{value}</p></div>; }

export function ExportDataSettings() {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [scope, setScope] = useState<'all' | 'custom'>('all');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [reauth, setReauth] = useState(false);
  const { userId } = useSecurity();
  const toast = useToast();
  const download = useCallback(() => {
    const data = getExportData();
    const inRange = (date: string) => scope === 'all' || (date >= from && date <= to);
    const expenses = data.expenses.filter((item) => inRange(item.expense_date));
    const expenseIds = new Set(expenses.map((item) => item.id));
    const repayments = data.repayments.filter((item) => inRange(item.repayment_date));
    const safe = { friends: data.friends, groups: data.groups, group_members: data.groupMembers, expenses, expense_participants: data.expenseParticipants.filter((item) => expenseIds.has(item.expense_id)), repayments };
    let content: string; let mime: string;
    if (format === 'json') { content = JSON.stringify(safe, null, 2); mime = 'application/json'; }
    else {
      const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const rows = [['type', 'title', 'friend_or_method', 'amount', 'currency', 'date', 'notes']];
      expenses.forEach((e) => rows.push(['expense', e.title, e.category, String(e.recoverable_amount), e.currency, e.expense_date, e.notes || '']));
      repayments.forEach((r) => rows.push(['repayment', r.is_settlement ? 'Dues cleared' : 'Payment', r.payment_method || '', String(r.amount), data.preferences.currency_code, r.repayment_date, r.notes || '']));
      content = rows.map((row) => row.map(quote).join(',')).join('\n'); mime = 'text/csv';
    }
    const url = URL.createObjectURL(new Blob([content], { type: mime })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `tab-data-${new Date().toISOString().slice(0, 10)}.${format}`; anchor.click(); URL.revokeObjectURL(url); toast('Your export is ready');
  }, [format, from, scope, to, toast]);
  const verifiedExport = useCallback(async () => {
    await recordVerifiedExport(userId);
    setReauth(false);
    download();
  }, [download, userId]);
  return <SettingsPage title="Export Your Data" description="Download a copy of your expense and repayment history."><div className="grid grid-cols-2 gap-3 mb-7">{([['csv', FileSpreadsheet, 'CSV', 'Best for Excel and spreadsheet applications.'], ['json', FileJson, 'JSON', 'Complete structured backup.']] as const).map(([value, Icon, title, desc]) => <button key={value} onClick={() => setFormat(value)} className={`relative rounded-2xl border-2 p-4 text-left min-h-36 ${format === value ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}><Icon size={23} className="mb-4" /><p className="font-bold">{title}</p><p className="text-xs leading-5 text-[var(--color-text-muted)] mt-1">{desc}</p>{format === value && <Check size={18} className="absolute right-3 top-3 text-[var(--color-primary)]" />}</button>)}</div>
    <SettingsSection title="Scope"><ChoiceRow selected={scope === 'all'} title="All Data" onClick={() => setScope('all')} /><ChoiceRow selected={scope === 'custom'} title="Custom Date Range" onClick={() => setScope('custom')} /></SettingsSection>
    {scope === 'custom' && <div className="grid grid-cols-2 gap-3 mb-7"><label><span className="text-xs font-semibold block mb-2">From</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label><span className="text-xs font-semibold block mb-2">To</span><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label></div>}
    <div className="rounded-2xl bg-[var(--color-surface-secondary)] p-4 mb-7 text-xs leading-5 text-[var(--color-text-secondary)]">Includes friends, expenses, participants, repayments, groups, dates, and notes. Authentication tokens, passwords, and internal security identifiers are never exported.</div>
    <button onClick={() => setReauth(true)} disabled={scope === 'custom' && (!from || !to || from > to)} className="w-full min-h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold disabled:opacity-40">Download {format.toUpperCase()}</button>
    <RequireReauthentication open={reauth} purpose="export all financial data" onCancel={() => setReauth(false)} onVerified={verifiedExport} />
  </SettingsPage>;
}

export function InstallAppSettings() {
  const [, render] = useState(0);
  const toast = useToast();
  useEffect(() => subscribeInstallPrompt(() => render((value) => value + 1)), []);
  const installed = isStandalone(); const supported = Boolean(getInstallPrompt());
  async function install() { const prompt = getInstallPrompt(); if (!prompt) return; await prompt.prompt(); const result = await prompt.userChoice; toast(result.outcome === 'accepted' ? 'App installed' : 'Installation cancelled'); }
  return <SettingsPage title="Install App"><div className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-6 text-center mt-4"><span className="w-16 h-16 rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center mx-auto"><Smartphone size={30} /></span><h2 className="text-xl font-bold mt-5">Install {APP_NAME}</h2><p className="text-sm leading-6 text-[var(--color-text-secondary)] mt-2">Install this app on your device for quicker access.</p>{installed ? <div className="mt-6 min-h-12 flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-semibold"><Check size={18} /> App Installed</div> : supported ? <button onClick={install} className="mt-6 w-full min-h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold">Install</button> : <p className="mt-6 text-xs leading-5 text-[var(--color-text-muted)]">Installation isn't available in this browser right now. On iPhone or iPad, use Share → Add to Home Screen.</p>}</div></SettingsPage>;
}
