import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-[var(--color-surface)] rounded-t-3xl shadow-2xl animate-sheet-up safe-bottom max-h-[88vh] flex flex-col"
      >
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-10 rounded-full bg-[var(--color-border)]" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
            <button onClick={onClose} className="size-11 rounded-full hover:bg-[var(--color-surface-secondary)] grid place-items-center" aria-label="Close">
              <X size={20} className="text-[var(--color-text-secondary)]" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-5 pb-6 pt-1">{children}</div>
      </div>
    </div>
  );
}
