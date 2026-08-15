import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

// Auth state is persisted in localStorage so the session survives closing the
// app, browser restarts, and installed-PWA restarts. Supabase automatically
// restores the session on startup and refreshes tokens in the background.
// Placeholder values let the app render a useful configuration screen instead
// of crashing before the user's environment variables have been added.
export const supabase = createClient(
  supabaseUrl || 'http://127.0.0.1:54321',
  supabasePublishableKey || 'missing-publishable-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  },
);
