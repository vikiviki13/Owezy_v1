create table if not exists public.app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

revoke all on table public.app_data from anon;
grant select, insert, update, delete on table public.app_data to authenticated;

drop policy if exists "Users can read their own app data" on public.app_data;
create policy "Users can read their own app data"
on public.app_data for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own app data" on public.app_data;
create policy "Users can insert their own app data"
on public.app_data for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own app data" on public.app_data;
create policy "Users can update their own app data"
on public.app_data for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own app data" on public.app_data;
create policy "Users can delete their own app data"
on public.app_data for delete to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding_completed boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_onboarding_timestamp check (
    onboarding_completed = false or onboarding_completed_at is not null
  )
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon;
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile" on public.profiles
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, onboarding_completed)
  values (new.id, false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

-- Normalized preference schema for clients that move preferences out of the
-- synced app_data document. The current PWA keeps the same fields inside
-- app_data so settings and domain records sync atomically.
create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  currency_code text not null default 'INR',
  number_format text not null default 'indian',
  decimal_display text not null default 'automatic',
  date_format text not null default 'DD MMM YYYY',
  time_format text not null default '12h',
  week_starts_on text not null default 'automatic',
  timezone text not null default 'Asia/Kolkata',
  timezone_mode text not null default 'automatic',
  language text not null default 'en',
  theme text not null default 'system',
  notifications_enabled boolean not null default true,
  payment_reminders_enabled boolean not null default true,
  pending_balance_reminders_enabled boolean not null default true,
  app_updates_enabled boolean not null default true,
  default_reminder_days integer not null default 3,
  default_reminder_time time not null default '19:00',
  app_lock_enabled boolean not null default false,
  auto_lock_duration text not null default '5m',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_currency_code check (currency_code ~ '^[A-Z]{3}$'),
  constraint user_preferences_time_format check (time_format in ('12h', '24h')),
  constraint user_preferences_theme check (theme in ('system', 'light', 'dark')),
  constraint user_preferences_reminder_days check (default_reminder_days between 1 and 365)
);

alter table public.user_preferences enable row level security;
revoke all on table public.user_preferences from anon;
grant select, insert, update, delete on table public.user_preferences to authenticated;

drop policy if exists "Users can read their preferences" on public.user_preferences;
create policy "Users can read their preferences" on public.user_preferences
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their preferences" on public.user_preferences;
create policy "Users can insert their preferences" on public.user_preferences
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their preferences" on public.user_preferences;
create policy "Users can update their preferences" on public.user_preferences
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter table public.user_preferences alter column auto_lock_duration set default '5m';

-- Security records are intentionally not readable or writable through the
-- public Data API. The authenticated `security` Edge Function is the only
-- application component that uses these tables (via the service role).
create table if not exists public.security_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  app_lock_enabled boolean not null default false,
  pin_hash text,
  pin_salt text,
  pin_hash_config jsonb,
  pin_created_at timestamptz,
  pin_updated_at timestamptz,
  failed_pin_attempt_count integer not null default 0,
  locked_until timestamptz,
  auto_lock_duration text not null default '5m',
  preferred_unlock_method text not null default 'device',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_profiles_auto_lock check (auto_lock_duration in ('immediately', '1m', '5m', '15m', '30m')),
  constraint security_profiles_unlock_method check (preferred_unlock_method in ('device', 'pin')),
  constraint security_profiles_pin_material check (
    (pin_hash is null and pin_salt is null and pin_hash_config is null)
    or
    (pin_hash is not null and pin_salt is not null and pin_hash_config is not null)
  )
);

create table if not exists public.user_authenticators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  rp_id text not null,
  public_key text not null,
  sign_count bigint not null default 0,
  transports text[] not null default '{}',
  authenticator_type text not null default 'singleDevice',
  backed_up boolean not null default false,
  device_name text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  is_active boolean not null default true
);

alter table public.user_authenticators add column if not exists rp_id text;
update public.user_authenticators set rp_id = 'unconfigured' where rp_id is null;
alter table public.user_authenticators alter column rp_id set not null;

create index if not exists user_authenticators_user_id_idx
on public.user_authenticators (user_id, is_active);

create table if not exists public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ceremony text not null,
  challenge text not null,
  origin text not null,
  rp_id text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint webauthn_challenges_ceremony check (ceremony in ('registration', 'authentication'))
);

create index if not exists webauthn_challenges_lookup_idx
on public.webauthn_challenges (user_id, ceremony, created_at desc);

create table if not exists public.app_unlock_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  authentication_method text not null,
  last_active_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint app_unlock_sessions_method check (authentication_method in ('device', 'pin', 'recovery'))
);

create index if not exists app_unlock_sessions_lookup_idx
on public.app_unlock_sessions (user_id, token_hash)
where revoked_at is null;

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  device_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint security_events_type check (event_type in (
    'app_lock_enabled',
    'app_lock_disabled',
    'pin_created',
    'pin_changed',
    'pin_failed',
    'webauthn_registered',
    'webauthn_removed',
    'webauthn_verified',
    'account_recovery',
    'data_export_verified'
  ))
);

create index if not exists security_events_user_created_idx
on public.security_events (user_id, created_at desc);

alter table public.security_profiles enable row level security;
alter table public.user_authenticators enable row level security;
alter table public.webauthn_challenges enable row level security;
alter table public.app_unlock_sessions enable row level security;
alter table public.security_events enable row level security;

revoke all on table public.security_profiles from anon, authenticated;
revoke all on table public.user_authenticators from anon, authenticated;
revoke all on table public.webauthn_challenges from anon, authenticated;
revoke all on table public.app_unlock_sessions from anon, authenticated;
revoke all on table public.security_events from anon, authenticated;

-- Users may read their sanitized activity feed directly if needed, but event
-- creation stays server-only. The client currently reads through the Edge
-- Function so metadata can be filtered before it reaches the browser.
grant select on table public.security_events to authenticated;
drop policy if exists "Users can read their security events" on public.security_events;
create policy "Users can read their security events" on public.security_events
for select to authenticated using ((select auth.uid()) = user_id);
