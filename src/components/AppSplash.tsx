export function AppSplash({ status }: { status?: string }) {
  return (
    <div className="splash" role="status" aria-label="Loading Owezy">
      <div className="splash-logo-container">
        <div className="splash-ambient-glow" />
        <div className="splash-ring-wave splash-ring-1" />
        <div className="splash-ring-wave splash-ring-2" />
        <div className="splash-logo-card">
          <img
            src="/icons/icon-512.png"
            srcSet="/icons/icon-192.png 192w, /icons/icon-512.png 512w"
            sizes="84px"
            alt="Owezy Logo"
            className="splash-logo-img"
            width={84}
            height={84}
            loading="eager"
            decoding="sync"
          />
          <span className="splash-sheen" />
        </div>
      </div>
      <div className="splash-brand-block">
        <p className="splash-title">Owezy</p>
        <p className="splash-tagline">Track what friends owe you</p>
      </div>
      <div className="splash-loader-bar">
        <div className="splash-loader-track" />
      </div>
      <div className="splash-dots">
        <i />
        <i />
        <i />
      </div>
      {status && <p className="splash-status">{status}</p>}
    </div>
  );
}

