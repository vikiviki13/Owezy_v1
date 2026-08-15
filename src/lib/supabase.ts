import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

// Auth state is tab-scoped so closing the browser removes refresh tokens from
// persistent storage. Remove tokens written by older releases before creating
// the client; users complete a normal sign-in once after this migration.
if (typeof window !== 'undefined') {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith('sb-') && key.endsWith('-auth-token')) localStorage.removeItem(key);
  }
}

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
      storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    },
  },
);
