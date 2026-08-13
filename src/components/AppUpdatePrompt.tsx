import { useState } from 'react';
import { AlertCircle, Download, LoaderCircle, Sparkles, WifiOff } from 'lucide-react';
import { RELEASE_NOTES } from '../lib/release';
import { useAppUpdate } from './AppUpdateContext';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';

export function AppUpdatePrompt() {
  const { needRefresh, updating, updateFailed, requiredUpdate, isOnline, applyUpdate, dismissUpdate } = useAppUpdate();
  const [showNotes, setShowNotes] = useState(false);

  if (!needRefresh) return null;

  const title = updating
    ? 'Updating Tab…'
    : requiredUpdate
      ? 'Update required'
      : updateFailed
        ? "Couldn't update the app"
        : isOnline
          ? 'New update available'
          : 'Update available';
  const description = updating
    ? 'This will only take a moment.'
    : requiredUpdate
      ? 'Please update Tab to continue securely.'
      : updateFailed
        ? 'Check your internet connection and try again.'
        : isOnline
          ? 'A newer version of Tab is ready with the latest improvements and fixes.'
          : 'Connect to the internet to install the latest version.';
  const Icon = updating ? LoaderCircle : updateFailed ? AlertCircle : isOnline ? Download : WifiOff;

  return (
    <Sheet open modal={requiredUpdate} onOpenChange={(open) => { if (!open) dismissUpdate(); }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        showOverlay={requiredUpdate}
        onEscapeKeyDown={(event) => { if (requiredUpdate) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (requiredUpdate) event.preventDefault(); }}
        className="mx-auto w-full max-w-md rounded-t-3xl border-[var(--color-border)] bg-[var(--color-surface)] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl"
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-[var(--color-border)]" aria-hidden="true" />
        <SheetHeader className="px-0 pb-1 pt-2 text-left">
          <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <Icon className={updating ? 'animate-spin' : ''} size={21} />
          </span>
          <SheetTitle className="text-lg font-bold text-[var(--color-text-primary)]">{title}</SheetTitle>
          <SheetDescription className="leading-6 text-[var(--color-text-secondary)]">{description}</SheetDescription>
        </SheetHeader>

        {showNotes && !updating && !updateFailed && (
          <div className="rounded-2xl bg-[var(--color-surface-secondary)] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-[var(--color-primary)]" />What's New</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-[var(--color-text-secondary)]">
              {RELEASE_NOTES.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        )}

        <div className="mt-2 grid gap-2">
          <Button className="min-h-12 w-full rounded-xl text-sm font-semibold" disabled={updating || !isOnline} onClick={() => void applyUpdate()}>
            {updating && <LoaderCircle className="animate-spin" />}
            {updateFailed ? 'Try Again' : 'Update Now'}
          </Button>
          {!requiredUpdate && !updating && (
            <div className="grid grid-cols-2 gap-2">
              {!updateFailed && <Button variant="ghost" className="min-h-11 rounded-xl" onClick={() => setShowNotes((value) => !value)}>What's New</Button>}
              <Button variant="ghost" className={`min-h-11 rounded-xl ${updateFailed ? 'col-span-2' : ''}`} onClick={dismissUpdate}>Later</Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
