import { Wallet } from 'lucide-react';

export function AppSplash({ status }: { status?: string }) {
  return (
    <div className="splash">
      <div className="splash-logo">
        <Wallet size={40} strokeWidth={2.2} />
        <span className="splash-ring" />
      </div>
      <p className="splash-title">Owezy</p>
      <div className="splash-dots"><i /><i /><i /></div>
      {status && <p className="splash-status">{status}</p>}
    </div>
  );
}
