import { ReactNode, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, LayoutGrid, User, BarChart3, Plus, Receipt, HandCoins, X, Share2, type LucideIcon } from 'lucide-react';
import { usePreferences } from './PreferencesContext';
import { MAIN_NAV_ORDER, MAIN_NAV_PATHS } from '../lib/navigation';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';

const NAV_ICONS: Record<string, LucideIcon> = {
  '/': Home,
  '/friends': Users,
  '/groups': LayoutGrid,
  '/profile': User,
};

const NAV_ITEMS = MAIN_NAV_ORDER.map(({ path, label }) => ({ to: path, label, icon: NAV_ICONS[path] }));

const MOBILE_NAV_ITEMS = [...NAV_ITEMS];
const DESKTOP_NAV_ITEMS = [
  ...NAV_ITEMS.slice(0, 2), // Home, Friends
  { to: '/groups', label: 'Groups', icon: LayoutGrid },
  { to: '/spending-overview', label: 'Spending Overview', icon: BarChart3 },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/profile/share', label: 'Share', icon: Share2 },
];

export function Shell({ children }: { children: ReactNode }) {
  const [quickOpen, setQuickOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  usePreferences();
  useSwipeNavigation();
  // Display navigation strictly on the 4 primary app tabs where it is needed:
  // '/', '/friends', '/groups', '/profile'.
  // Hide navigation on all forms, detail screens, sub-pages, statements, and settings.
  const isMainScreen = MAIN_NAV_PATHS.includes(location.pathname);
  const navDir = (location.state as { navDir?: 'next' | 'prev' } | null)?.navDir;

  return (
    <div className="min-h-screen flex bg-[var(--color-bg)]">
      {/* Premium Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-72 border-r border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xl px-5 py-7 sticky top-0 h-screen select-none z-30">
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="relative group">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-emerald-400 opacity-30 blur-sm group-hover:opacity-50 transition" />
            <img src="/icons/icon-512.png" alt="Owezy" className="relative w-9 h-9 rounded-2xl shadow-md object-contain bg-white dark:bg-zinc-900 p-0.5" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-[var(--color-text-primary)] to-[var(--color-primary)] bg-clip-text text-transparent">Owezy</span>
            <span className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">Expense Manager</span>
          </div>
        </div>

        {isMainScreen && (
          <button
            onClick={() => setQuickOpen(true)}
            className="group relative flex items-center justify-center gap-2.5 bg-gradient-to-r from-[var(--color-primary)] to-emerald-600 hover:from-[var(--color-primary-hover)] hover:to-emerald-700 text-white font-semibold rounded-2xl py-3 px-4 mb-7 shadow-lg shadow-[var(--color-primary)]/25 active:scale-[0.98] transition-all duration-200"
            data-no-swipe
          >
            <div className="size-6 rounded-full bg-white/20 flex items-center justify-center">
              <Plus size={16} className="transition-transform group-hover:rotate-90 duration-300" />
            </div>
            <span>New Transaction</span>
          </button>
        )}

        <nav className="flex flex-col gap-1.5 flex-1" data-no-swipe>
          {DESKTOP_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `relative flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/20'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} className={isActive ? 'text-white' : 'text-[var(--color-text-muted)]'} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <div className="size-1.5 rounded-full bg-white animate-pulse" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <main
          key={location.pathname}
          className={`flex-1 ${isMainScreen ? 'pb-28' : 'pb-8'} md:pb-8 max-w-2xl w-full mx-auto ${
            navDir === 'next'
              ? 'animate-nav-next'
              : navDir === 'prev'
                ? 'animate-nav-prev'
                : 'animate-nav-fade'
          }`}
        >
          {children}
        </main>

        {/* Hyper-Modern Shadcn-Style Glass Dock (Displayed ONLY where needed on main screens) */}
        {isMainScreen && (
          <div className="md:hidden premium-dock-container" data-no-swipe>
            <nav className="premium-dock" aria-label="Bottom Navigation">
              {/* Home & Friends */}
              {MOBILE_NAV_ITEMS.slice(0, 2).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `premium-tab ${isActive ? 'active' : ''}`}
                  aria-label={item.label}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </NavLink>
              ))}

              {/* Center Premium Glowing Emerald Action Button */}
              <button
                type="button"
                onClick={() => setQuickOpen(true)}
                className="premium-fab"
                aria-label="Create New"
              >
                <Plus />
              </button>

              {/* Groups & Profile */}
              {MOBILE_NAV_ITEMS.slice(2).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `premium-tab ${isActive ? 'active' : ''}`}
                  aria-label={item.label}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </div>

      {quickOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" data-no-swipe>
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
