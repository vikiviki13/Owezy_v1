// Supabase Realtime subscription for the user's app_data row. When another
// device pushes an update, this channel fires and the sync manager pulls +
// merges the latest document into the local cache without a manual refresh.
//
// Delivery is governed by the existing row-level security policy on
// app_data (auth.uid() = user_id), so only the signed-in user's own changes
// reach this client — the same boundary the App Lock depends on.

import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export function subscribeToAppData(userId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured || typeof window === 'undefined') return () => {};

  const channel = supabase
    .channel(`app-data-sync-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_data', filter: `user_id=eq.${userId}` },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}