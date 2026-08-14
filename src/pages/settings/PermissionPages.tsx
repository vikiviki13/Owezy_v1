import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, Camera, ChevronRight, ContactRound, Fingerprint, Image, LoaderCircle, ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { APP_NAME } from '../../components/Brand';
import { ContactImportFlow } from '../../components/contacts/ContactImportFlow';
import {
  PermissionBlockedDialog,
  PermissionExplanationDialog,
  PermissionStatusBadge,
} from '../../components/permissions/PermissionUI';
import { useSecurity } from '../../components/SecurityContext';
import { SettingsPage, SettingsSection } from '../../components/SettingsUI';
import { useToast } from '../../components/ToastContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { contactAvailability } from '../../lib/contactService';
import {
  getAppPermissionSnapshots,
  PermissionRequestError,
  requestCameraAccess,
  requestNotificationAccess,
  type AppPermissionKey,
  type AppPermissionSnapshot,
  type AppPermissionState,
} from '../../lib/permissionService';

interface PermissionDefinition {
  key: AppPermissionKey;
  icon: LucideIcon;
  title: string;
  description: string;
  why: string;
  dataUsage: string;
}

const permissionDefinitions: PermissionDefinition[] = [
  {
    key: 'contacts',
    icon: ContactRound,
    title: 'Contacts',
    description: 'Find people from your device contacts and add them as friends.',
    why: 'Choose people you already know and add them as friends without typing their information manually.',
    dataUsage: 'Selected contacts remain on this device unless you explicitly add them as friends.',
  },
  {
    key: 'camera',
    icon: Camera,
    title: 'Camera',
    description: 'Take photos of bills, receipts and profile pictures.',
    why: 'Capture a new image directly when adding a bill, receipt, attachment or profile picture.',
    dataUsage: 'Camera access is used only after you choose Take Photo. Owezy does not record or monitor your camera in the background.',
  },
  {
    key: 'photos',
    icon: Image,
    title: 'Photos & Files',
    description: 'Select receipt images, profile photos and other attachments from your device.',
    why: 'Choose an existing image or attachment instead of taking a new photo.',
    dataUsage: 'Browser file pickers share only files you select. This is not treated as permanent access to your photo library or files.',
  },
  {
    key: 'notifications',
    icon: Bell,
    title: 'Notifications',
    description: 'Receive expense reminders, payment reminders and important app updates.',
    why: 'Notify you about reminders and important updates you have enabled.',
    dataUsage: 'Notification permission controls whether this browser or installed PWA can display alerts from Owezy.',
  },
  {
    key: 'device-security',
    icon: Fingerprint,
    title: 'Device Security',
    description: "Use your device's secure authentication method to unlock Owezy.",
    why: 'Verify your identity using a platform authenticator before opening protected financial records.',
    dataUsage: 'Biometric information is handled by your device. Owezy stores only the registered WebAuthn credential, never fingerprint or face data.',
  },
];

function usePermissionSnapshots() {
  const { status } = useSecurity();
  const [snapshots, setSnapshots] = useState<AppPermissionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const next = await getAppPermissionSnapshots(Boolean(status?.webAuthnEnabled));
    setSnapshots(next);
    setLoading(false);
    return next;
  }, [status?.webAuthnEnabled]);

  useEffect(() => {
    let active = true;
    void getAppPermissionSnapshots(Boolean(status?.webAuthnEnabled)).then((next) => {
      if (active) { setSnapshots(next); setLoading(false); }
    });
    const checkAgain = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('focus', checkAgain);
    document.addEventListener('visibilitychange', checkAgain);
    return () => {
      active = false;
      window.removeEventListener('focus', checkAgain);
      document.removeEventListener('visibilitychange', checkAgain);
    };
  }, [refresh, status?.webAuthnEnabled]);

  const states = useMemo(() => new Map(snapshots.map((item) => [item.key, item.state])), [snapshots]);
  return { states, loading, refresh };
}

export function AppPermissionsPage() {
  const { states, loading } = usePermissionSnapshots();
  const stateList = [...states.values()];
  const enabledCount = stateList.filter((state) => state === 'allowed' || state === 'enabled').length;
  const onDemandCount = stateList.filter((state) => state === 'available_on_demand').length;
  const availableCount = stateList.filter((state) => state === 'available').length;
  const blockedCount = stateList.filter((state) => state === 'blocked').length;

  return <SettingsPage title="App Permissions" description={`Control what ${APP_NAME} can access on this device. You can change these permissions at any time.`}>
    <Card className="mb-7 rounded-3xl border-primary/20 bg-primary/5">
      <CardHeader>
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><ShieldCheck size={22} /></span>
        <CardTitle className="mt-3">Device Access</CardTitle>
        <p className="text-sm text-muted-foreground">You're in control. {APP_NAME} only uses permissions for features you explicitly use.</p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {loading ? <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Checking this device…</span> : <>
          <SummaryPill value={enabledCount} label="enabled" />
          <SummaryPill value={onDemandCount} label="available on demand" />
          <SummaryPill value={availableCount} label="available" />
          <SummaryPill value={blockedCount} label="blocked" destructive={blockedCount > 0} />
        </>}
      </CardContent>
    </Card>

    <SettingsSection title="Permissions">
      {permissionDefinitions.map((permission) => {
        const Icon = permission.icon;
        const state = states.get(permission.key);
        return <Link key={permission.key} to={`/profile/privacy/permissions/${permission.key}`} className="flex min-h-20 items-center gap-3 px-4 py-4 transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground"><Icon size={20} /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{permission.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{permission.description}</span>{state && <span className="mt-2 block"><PermissionStatusBadge state={state} /></span>}</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>;
      })}
    </SettingsSection>
  </SettingsPage>;
}

function SummaryPill({ value, label, destructive = false }: { value: number; label: string; destructive?: boolean }) {
  return <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${destructive ? 'border-destructive/20 bg-destructive/10 text-destructive' : 'border-border bg-card text-muted-foreground'}`}>{value} {label}</span>;
}

export function AppPermissionDetailPage() {
  const { permissionKey } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const definition = permissionDefinitions.find((item) => item.key === permissionKey);
  const { states, refresh } = usePermissionSnapshots();
  const [contactOpen, setContactOpen] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const state = definition ? states.get(definition.key) : undefined;
  const photoInput = useRef<HTMLInputElement>(null);

  if (!definition) return <Navigate to="/profile/privacy/permissions" replace />;
  const Icon = definition.icon;

  async function requestPermission() {
    setRequesting(true);
    try {
      if (definition?.key === 'camera') {
        const stream = await requestCameraAccess();
        stream.getTracks().forEach((track) => track.stop());
        toast('Camera access allowed');
      } else if (definition?.key === 'notifications') {
        const next = await requestNotificationAccess();
        if (next === 'allowed') toast('Notifications allowed');
        else if (next === 'blocked') setBlockedOpen(true);
      }
      setExplanationOpen(false);
      await refresh();
    } catch (caught) {
      setExplanationOpen(false);
      if (caught instanceof PermissionRequestError && caught.code === 'blocked') setBlockedOpen(true);
      else toast(caught instanceof Error ? caught.message : 'Permission could not be requested');
      await refresh();
    } finally {
      setRequesting(false);
    }
  }

  return <SettingsPage title={definition.title}>
    <Card className="mb-7 rounded-3xl">
      <CardHeader>
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon size={24} /></span>
        <CardTitle className="mt-3">{definition.title}</CardTitle>
        {state && <PermissionStatusBadge state={state} />}
      </CardHeader>
    </Card>
    <SettingsSection title="Access">
      <div className="p-4"><p className="text-sm font-semibold">Current access</p><div className="mt-2">{state ? <PermissionStatusBadge state={state} /> : <span className="text-sm text-muted-foreground">Checking…</span>}</div></div>
    </SettingsSection>
    <SettingsSection title={`Why ${APP_NAME} needs this`}><p className="p-4 text-sm leading-6 text-muted-foreground">{definition.why}</p></SettingsSection>
    <SettingsSection title="Data Usage"><p className="p-4 text-sm leading-6 text-muted-foreground">{definition.dataUsage}</p></SettingsSection>
    <PermissionAction
      permissionKey={definition.key}
      state={state}
      onContacts={() => setContactOpen(true)}
      onExplain={() => state === 'blocked' ? setBlockedOpen(true) : setExplanationOpen(true)}
      onPhotos={() => photoInput.current?.click()}
    />
    <input ref={photoInput} type="file" className="hidden" onChange={(event) => { if (event.target.files?.length) toast('File access works only for the item you selected'); event.currentTarget.value = ''; }} />

    <ContactImportFlow
      open={contactOpen}
      onOpenChange={setContactOpen}
      onContactSelected={(contact) => toast(`${contact.name} is stored locally until you add them as a friend`)}
      onExistingFriendSelected={(friend) => navigate(`/friends/${friend.id}`)}
      onAddManually={() => navigate('/friends')}
    />
    <PermissionExplanationDialog
      open={explanationOpen}
      onOpenChange={setExplanationOpen}
      icon={Icon}
      title={definition.key === 'camera' ? 'Allow Camera Access' : 'Stay Updated'}
      description={definition.key === 'camera'
        ? `${APP_NAME} needs camera access to take photos of bills, receipts or profile pictures.`
        : 'Allow notifications for payment reminders, pending balances and important app updates.'}
      primaryLabel={definition.key === 'notifications' ? 'Enable Notifications' : 'Continue'}
      busy={requesting}
      onContinue={() => void requestPermission()}
    />
    <PermissionBlockedDialog open={blockedOpen} onOpenChange={setBlockedOpen} permissionName={definition.title} />
  </SettingsPage>;
}

function PermissionAction({ permissionKey, state, onContacts, onExplain, onPhotos }: {
  permissionKey: AppPermissionKey;
  state?: AppPermissionState;
  onContacts: () => void;
  onExplain: () => void;
  onPhotos: () => void;
}) {
  if (permissionKey === 'contacts') {
    const available = contactAvailability() === 'available_on_demand';
    return <Button className="w-full" disabled={!available} onClick={onContacts}><ContactRound />{available ? 'Choose Contacts' : 'Contact Picker Not Available'}</Button>;
  }
  if (permissionKey === 'camera') {
    if (state === 'unsupported' || state === 'not_available') return <Button className="w-full" disabled><Camera />Camera Not Available</Button>;
    return <Button className="w-full" onClick={onExplain}><Camera />{state === 'blocked' ? 'How to Enable' : state === 'allowed' ? 'Check Camera Access' : 'Allow Camera Access'}</Button>;
  }
  if (permissionKey === 'photos') return <Button className="w-full" onClick={onPhotos}><Image />Choose a File</Button>;
  if (permissionKey === 'notifications') {
    if (state === 'unsupported') return <Button className="w-full" disabled><Bell />Notifications Not Supported</Button>;
    if (state === 'allowed') return <Button asChild className="w-full"><Link to="/profile/notifications"><Bell />Notification Settings</Link></Button>;
    return <Button className="w-full" onClick={onExplain}><Bell />{state === 'blocked' ? 'How to Enable' : 'Enable Notifications'}</Button>;
  }
  return <Button asChild className="w-full"><Link to="/profile/security/devices"><Fingerprint />Manage Device Security</Link></Button>;
}
