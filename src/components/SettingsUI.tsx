import { useId, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Check, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Switch } from './ui/switch';

export function SettingsPage({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-full pb-10 safe-top">
      <header className="sticky top-0 z-20 bg-[color:var(--color-bg)]/95 backdrop-blur border-b border-[var(--color-border)] px-3 h-14 flex items-center">
        <button onClick={() => navigate(-1)} aria-label="Go back" className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-secondary)]"><ArrowLeft size={21} /></button>
        <h1 className="text-lg font-semibold ml-1">{title}</h1>
      </header>
      <div className="px-4 pt-5">
        {description && <p className="text-sm leading-6 text-[var(--color-text-secondary)] mb-5">{description}</p>}
        {children}
      </div>
    </div>
  );
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-[12px] uppercase tracking-[0.08em] font-bold text-[var(--color-text-muted)] px-1 mb-2">{title}</h2>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden divide-y divide-[var(--color-border)]">{children}</div>
    </section>
  );
}

export function SettingsRow({ icon: Icon, title, description, value, to, onClick, danger = false, trailing = true }: {
  icon: LucideIcon; title: string; description?: string; value?: string; to?: string; onClick?: () => void; danger?: boolean; trailing?: boolean;
}) {
  const content = (
    <>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${danger ? 'bg-red-50 dark:bg-red-950/30 text-[var(--color-error)]' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'}`}><Icon size={18} /></span>
      <span className="min-w-0 flex-1 text-left">
        <span className={`block text-[15px] font-medium ${danger ? 'text-[var(--color-error)]' : ''}`}>{title}</span>
        {description && <span className="block text-xs leading-5 text-[var(--color-text-muted)] mt-0.5">{description}</span>}
      </span>
      {value && <span className="text-sm text-[var(--color-text-secondary)] text-right max-w-[42%] truncate">{value}</span>}
      {trailing && <ChevronRight size={17} className="text-[var(--color-text-muted)] shrink-0" />}
    </>
  );
  const cls = "w-full min-h-14 px-3.5 py-3 flex items-center gap-3 active:bg-[var(--color-surface-secondary)] transition-colors";
  return to ? <Link to={to} className={cls}>{content}</Link> : <button type="button" onClick={onClick} className={cls}>{content}</button>;
}

export function ChoiceRow({ selected, title, description, onClick }: { selected: boolean; title: string; description?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full min-h-[64px] px-4 py-3 flex items-center gap-3 text-left active:bg-[var(--color-surface-secondary)]">
      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'border-[var(--color-primary)] bg-[var(--color-primary)]' : 'border-[var(--color-border)]'}`}>{selected && <Check size={13} className="text-white" strokeWidth={3} />}</span>
      <span className="flex-1"><span className="block font-semibold text-[15px]">{title}</span>{description && <span className="block text-xs text-[var(--color-text-muted)] mt-1">{description}</span>}</span>
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
  );
}

export function ToggleRow({ title, description, checked, onChange }: { title: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return (
    <div className="group min-h-[72px] px-4 py-3.5 flex items-center gap-4 transition-colors hover:bg-[var(--color-surface-secondary)]/55">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer select-none">
        <span className="block text-[15px] font-medium leading-5">{title}</span>
        {description && <span className="block text-xs leading-5 text-[var(--color-text-muted)] mt-1">{description}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}
