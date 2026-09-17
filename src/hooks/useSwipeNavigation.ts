// Swipe navigation for the main app screens. Uses the existing router for
// navigation (browser history, back button, deep links all keep working) and
// the central navigation configuration for adjacency — swipe left goes to the
// next screen in the group, swipe right to the previous, never beyond the
// first or last screen, never on sub-pages or forms.

import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MAIN_NAV_PATHS } from '../lib/navigation';
import { useHorizontalSwipe } from './useHorizontalSwipe';

export function useSwipeNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const enabled = MAIN_NAV_PATHS.includes(location.pathname);

  const handlers = useMemo(() => ({
    onSwipeLeft: () => {
      const index = MAIN_NAV_PATHS.indexOf(location.pathname);
      const next = MAIN_NAV_PATHS[index + 1];
      if (next) navigate(next, { state: { navDir: 'next' } });
    },
    onSwipeRight: () => {
      const index = MAIN_NAV_PATHS.indexOf(location.pathname);
      const prev = MAIN_NAV_PATHS[index - 1];
      if (prev) navigate(prev, { state: { navDir: 'prev' } });
    },
  }), [location.pathname, navigate]);

  useHorizontalSwipe(handlers, enabled);
}