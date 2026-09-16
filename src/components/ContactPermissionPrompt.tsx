interface ContactPermissionPromptProps {
  onAllow: () => void;
  onCancel: () => void;
  onOpenSettings: () => void;
}

export function ContactPermissionPrompt({ onAllow, onCancel, onOpenSettings }: ContactPermissionPromptProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/50" onClick={onCancel} aria-label="Cancel" />
      <div className="relative w-full max-w-sm rounded-3xl bg-[var(--color-surface)] p-5 shadow-2xl">
        <h2 className="text-lg font-bold">Contact access required</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          Owezy needs permission to read your contacts to help you add friends quickly.
          Your contacts are accessed securely through your device and are never uploaded to our servers.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={onAllow} className="min-h-12 rounded-xl bg-[var(--color-primary)] text-white font-semibold">Allow</button>
          <button onClick={onOpenSettings} className="min-h-12 rounded-xl border border-[var(--color-border)] font-semibold">Settings</button>
          <button onClick={onCancel} className="min-h-12 rounded-xl border border-[var(--color-border)] font-semibold col-span-2">Not now</button>
        </div>
      </div>
    </div>
  );
}
