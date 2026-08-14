import { useEffect, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Ban, Check, CheckCircle2, CircleHelp, Clock3, LoaderCircle, ShieldAlert, ShieldCheck,
} from 'lucide-react';
import type { AppPermissionState } from '../../lib/permissionService';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';

const statusPresentation: Record<AppPermissionState, { label: string; icon: LucideIcon; className: string }> = {
  allowed: { label: 'Allowed', icon: CheckCircle2, className: 'border-success/20 bg-success/10 text-success' },
  enabled: { label: 'Enabled', icon: ShieldCheck, className: 'border-success/20 bg-success/10 text-success' },
  not_requested: { label: 'Not requested', icon: CircleHelp, className: 'border-border bg-secondary text-muted-foreground' },
  blocked: { label: 'Blocked', icon: ShieldAlert, className: 'border-destructive/20 bg-destructive/10 text-destructive' },
  unsupported: { label: 'Not supported', icon: Ban, className: 'border-border bg-secondary text-muted-foreground' },
  available_on_demand: { label: 'Available on demand', icon: Clock3, className: 'border-primary/20 bg-primary/10 text-primary' },
  available: { label: 'Available', icon: Check, className: 'border-primary/20 bg-primary/10 text-primary' },
  limited: { label: 'Limited', icon: CircleHelp, className: 'border-border bg-secondary text-muted-foreground' },
  not_available: { label: 'Not available', icon: Ban, className: 'border-border bg-secondary text-muted-foreground' },
};

export function PermissionStatusBadge({ state }: { state: AppPermissionState }) {
  const presentation = statusPresentation[state];
  const Icon = presentation.icon;
  return <Badge variant="outline" className={presentation.className}><Icon />{presentation.label}</Badge>;
}

export function PermissionExplanationDialog({
  open,
  onOpenChange,
  icon: Icon,
  title,
  description,
  points,
  primaryLabel = 'Continue',
  busy = false,
  onContinue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  title: string;
  description: string;
  points?: string[];
  primaryLabel?: string;
  busy?: boolean;
  onContinue: () => void;
}) {
  return <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
    <DialogContent showCloseButton={!busy}>
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon size={24} /></span>
      <DialogHeader>
        <DialogTitle className="text-lg font-bold leading-tight">{title}</DialogTitle>
        <DialogDescription className="leading-6">{description}</DialogDescription>
      </DialogHeader>
      {points && <div className="space-y-3 rounded-2xl bg-secondary p-4">
        {points.map((point) => <p key={point} className="flex gap-2 text-sm leading-5"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />{point}</p>)}
      </div>}
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Not Now</Button>
        <Button disabled={busy} onClick={onContinue}>{busy ? <LoaderCircle className="animate-spin" /> : null}{busy ? 'Please wait…' : primaryLabel}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function PermissionBlockedDialog({
  open,
  onOpenChange,
  permissionName,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissionName: string;
  children?: ReactNode;
}) {
  const [showHelp, setShowHelp] = useState(false);
  useEffect(() => { if (!open) setShowHelp(false); }, [open]);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><ShieldAlert size={24} /></span>
      <DialogHeader>
        <DialogTitle className="text-lg font-bold leading-tight">{showHelp ? `How to enable ${permissionName}` : 'Permission Blocked'}</DialogTitle>
        <DialogDescription className="leading-6">
          {showHelp
            ? `Open this site's permissions in your browser or device settings, allow ${permissionName.toLowerCase()}, then return to Owezy and try again.`
            : `${permissionName} access is blocked for Owezy. Enable it from your browser or device settings to use this feature.`}
        </DialogDescription>
      </DialogHeader>
      {children}
      <DialogFooter>
        {!showHelp && <Button variant="outline" onClick={() => onOpenChange(false)}>Not Now</Button>}
        <Button onClick={() => showHelp ? onOpenChange(false) : setShowHelp(true)}>{showHelp ? 'Got It' : 'How to Enable'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
