// Central navigation configuration for swipe navigation.
//
// Screens listed here form the main application navigation group — the same
// structure as the bottom navigation bar / desktop sidebar. Swipe gestures
// move between adjacent entries only; sub-pages (friend detail, settings,
// forms, auth, onboarding) are intentionally not part of this group.

export const MAIN_NAV_ORDER = [
  { path: '/', label: 'Home' },
  { path: '/friends', label: 'Friends' },
  { path: '/activity', label: 'Activity' },
  { path: '/groups', label: 'Groups' },
  { path: '/profile', label: 'Profile' },
] as const;

export const MAIN_NAV_PATHS: readonly string[] = MAIN_NAV_ORDER.map((entry) => entry.path);