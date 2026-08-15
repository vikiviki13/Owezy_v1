-- Run this only after `schema.sql`, the `security` Edge Function, and the
-- updated frontend have been deployed successfully. It removes direct browser
-- Data API access so App Lock is enforced at the Edge Function boundary.

revoke all on table public.app_data from authenticated;
revoke all on table public.friends from authenticated;
revoke all on table public.security_events from authenticated;

-- Leave RLS enabled and policies in place as defense in depth. The service
-- role used exclusively inside the Edge Function bypasses these grants.
