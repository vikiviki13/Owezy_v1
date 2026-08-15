import { ReactNode, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Activity, LayoutGrid, User, Plus, Receipt, HandCoins, X, Share2 } from 'lucide-react';
import { usePreferences } from './PreferencesContext';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/friends', label: 'Friends', icon: Users },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/groups', label: 'Groups', icon: LayoutGrid },
  { to: '/profile', label: 'Profile', icon: User },
];

const MOBILE_NAV_ITEMS = [...NAV_ITEMS];
const DESKTOP_NAV_ITEMS = [...NAV_ITEMS, { to: '/profile/share', label: 'Share', icon: Share2 }];

export function Shell({ children }: { children: ReactNode }) {
  const [quickOpen, setQuickOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  usePreferences();
  const isSubPage = location.pathname.startsWith('/profile/') || location.pathname === '/friends/import';

  return (
    <div className="min-h-screen flex bg-[var(--color-bg)]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-2 mb-8">
          <img src="/icon.png" alt="Owezy" className="w-8 h-8 rounded-xl object-cover" />
          <span className="font-bold text-lg">Owezy</span>
        </div>
        {!isSubPage && <button
          onClick={() => setQuickOpen(true)}
          className="flex items-center gap-2 justify-center bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium rounded-xl py-2.5 mb-6 transition-colors"
        >
          <Plus size={18} /> Add
        </button>}
        <nav className="flex flex-col gap-1">
          {DESKTOP_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-hover)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 pb-24 md:pb-8 max-w-2xl w-full mx-auto">{children}</main>

        {/* Mobile floating add button */}
        {!isSubPage && <button
          onClick={() => setQuickOpen(true)}
          className="md:hidden fixed bottom-20 right-5 z-40 w-14 h-14 rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white shadow-lg shadow-black/20 flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Add"
        >
          <Plus size={26} />
        </button>}

        {/* Mobile bottom nav */}
        {!isSubPage && <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--color-surface)] border-t border-[var(--color-border)] safe-bottom">
          <div className="flex items-stretch justify-around max-w-2xl mx-auto">
            {MOBILE_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 flex-1 text-[11px] font-medium transition-colors ${
                    isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
                  }`
                }
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>}
      </div>

      {quickOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setQuickOpen(false)} />
          <div className="relative w-full max-w-md bg-[var(--color-surface)] rounded-t-3xl shadow-2xl animate-sheet-up safe-bottom">
            <div className="flex justify-center pt-3">
              <div className="h-1.5 w-10 rounded-full bg-[var(--color-border)]" />
            </div>
            <div className="flex items-center justify-between px-5 pt-3 pb-1">
              <h2 className="text-lg font-semibold">Quick add</h2>
              <button onClick={() => setQuickOpen(false)} className="p-1.5 rounded-full hover:bg-[var(--color-surface-secondary)]">
                <X size={20} className="text-[var(--color-text-secondary)]" />
              </button>
            </div>
            <div className="px-5 pb-6 pt-2 flex flex-col gap-3">
              <button
                onClick={() => { setQuickOpen(false); navigate('/add-expense'); }}
                className="flex items-center gap-4 p-4 rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-[var(--color-primary-soft)] flex items-center justify-center shrink-0">
                  <Receipt size={20} className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="font-medium">Add Expense</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Record something you paid for a friend</p>
                </div>
              </button>
              <button
                onClick={() => { setQuickOpen(false); navigate('/record-repayment'); }}
                className="flex items-center gap-4 p-4 rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-[var(--color-primary-soft)] flex items-center justify-center shrink-0">
                  <HandCoins size={20} className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="font-medium">Record Repayment</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Log money a friend paid you back</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
