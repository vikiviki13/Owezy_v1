import { avatarColor, initials } from '../lib/utils';

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold text-white shrink-0 select-none"
      style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
}

export function AvatarGroup({ names, max = 3 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((n, i) => (
        <div key={i} className="ring-2 ring-[var(--color-surface)] rounded-full">
          <Avatar name={n} size={28} />
        </div>
      ))}
      {extra > 0 && (
        <div
          className="flex items-center justify-center rounded-full text-xs font-semibold ring-2 ring-[var(--color-surface)]"
          style={{ width: 28, height: 28, background: 'var(--color-surface-secondary)', color: 'var(--color-text-secondary)' }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
