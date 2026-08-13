export const APP_NAME = 'Owezy';
export const APP_TAGLINE = 'Friend expense tracker';
export const APP_SUPPORT_EMAIL = 'vigneshwaranvmece@gmail.com';

export function BrandLogo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--color-primary)] text-white font-extrabold select-none ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      <span className="absolute inset-0 flex items-center justify-center">O</span>
      <img
        src="/logo.svg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        onError={(e) => { e.currentTarget.remove(); }}
      />
    </span>
  );
}

export function BrandWordmark({ className = '' }: { className?: string }) {
  return <span className={`font-bold tracking-tight ${className}`}>{APP_NAME}</span>;
}
