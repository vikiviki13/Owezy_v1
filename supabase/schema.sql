create table if not exists public.app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

revoke all on table public.app_data from anon;
-- Direct access is removed by `security_enforcement.sql` after the new Edge
-- Function and frontend are deployed. Keeping this grant during the staged
-- upgrade prevents an outage for clients running the previous release.
grant select, insert, update, delete on table public.app_data to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'app_data_size_limit'
  ) then
    alter table public.app_data
      add constraint app_data_size_limit
      check (octet_length(data::text) <= 2097152) not valid;
  end if;
end $$;

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

-- Confirmed contact imports are written as individual friend records. Device
-- contact drafts never enter this table; the client sends only reviewed fields.
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  nickname text,
  whatsapp_e164 text not null,
  phone_number text not null,
  email text,
  created_at timestamptz not null default now(),
  constraint friends_name_not_blank check (length(btrim(name)) > 0),
  constraint friends_whatsapp_e164 check (whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint friends_owner_whatsapp_unique unique (owner_id, whatsapp_e164)
);

alter table public.friends enable row level security;
revoke all on table public.friends from anon;
-- Direct access is removed by `security_enforcement.sql` as the final staged
-- rollout step once confirmed contact imports use the Edge Function.
grant select, insert, update, delete on table public.friends to authenticated;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'friends_field_lengths') then
    alter table public.friends add constraint friends_field_lengths check (
      length(name) <= 120
      and (nickname is null or length(nickname) <= 80)
      and length(phone_number) <= 32
      and (email is null or length(email) <= 254)
    ) not valid;
  end if;
end $$;

drop policy if exists "Users can read their own friends" on public.friends;
create policy "Users can read their own friends" on public.friends
for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "Users can insert their own friends" on public.friends;
create policy "Users can insert their own friends" on public.friends
for insert to authenticated with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can update their own friends" on public.friends;
create policy "Users can update their own friends" on public.friends
for update to authenticated using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can delete their own friends" on public.friends;
create policy "Users can delete their own friends" on public.friends
for delete to authenticated using ((select auth.uid()) = owner_id);

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
    'data_export_verified',
    'password_reauthentication_failed',
    'password_reauthentication_succeeded',
    'security_rate_limited',
    'private_data_access_denied',
    'friend_import_failed',
    'all_sessions_revoked'
  ))
);

-- Recreate the event constraint when upgrading an existing project so the
-- newly monitored security events are accepted.
alter table public.security_events drop constraint if exists security_events_type;
alter table public.security_events add constraint security_events_type check (event_type in (
  'app_lock_enabled',
  'app_lock_disabled',
  'pin_created',
  'pin_changed',
  'pin_failed',
  'webauthn_registered',
  'webauthn_removed',
  'webauthn_verified',
  'account_recovery',
  'data_export_verified',
  'password_reauthentication_failed',
  'password_reauthentication_succeeded',
  'security_rate_limited',
  'private_data_access_denied',
  'friend_import_failed',
  'all_sessions_revoked'
));

create index if not exists security_events_user_created_idx
on public.security_events (user_id, created_at desc);

-- Short-lived, action-bound proofs produced only after Supabase Auth has
-- explicitly verified the current account password. Tokens are stored hashed.
create table if not exists public.security_step_up_proofs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  purpose text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint security_step_up_purpose check (purpose in ('security_setup', 'pin_recovery'))
);

create index if not exists security_step_up_proofs_lookup_idx
on public.security_step_up_proofs (user_id, token_hash, purpose)
where consumed_at is null;

-- Server-only counters provide atomic throttling across concurrent Edge
-- Function instances. Buckets contain only a purpose and a hashed IP label.
create table if not exists public.security_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  attempt_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, bucket),
  constraint security_rate_limit_bucket_length check (length(bucket) between 1 and 120),
  constraint security_rate_limit_attempts check (attempt_count >= 0)
);

-- Alerts are intentionally separate from the user-visible activity feed.
-- Operators can forward these rows to their monitoring provider without
-- exposing PINs, tokens, credentials, raw IP addresses, or financial data.
create table if not exists public.security_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  alert_type text not null,
  severity text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  constraint security_alert_severity check (severity in ('low', 'medium', 'high', 'critical')),
  constraint security_alert_type_length check (length(alert_type) between 1 and 80)
);

create index if not exists security_alerts_created_idx
on public.security_alerts (created_at desc)
where acknowledged_at is null;

-- Claim a PIN verification attempt while holding the profile row lock. This
-- makes the escalating delay reliable even when requests arrive concurrently.
create or replace function public.claim_pin_attempt(p_user_id uuid)
returns table (attempts integer, locked_until timestamptz, allowed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile public.security_profiles%rowtype;
  next_attempts integer;
  delay_seconds integer;
  next_locked_until timestamptz;
begin
  select * into profile
  from public.security_profiles
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'security profile not found';
  end if;

  if profile.locked_until is not null and profile.locked_until > now() then
    return query select profile.failed_pin_attempt_count, profile.locked_until, false;
    return;
  end if;

  next_attempts := profile.failed_pin_attempt_count + 1;
  delay_seconds := case
    when next_attempts >= 10 then 300
    when next_attempts >= 8 then 60
    when next_attempts >= 5 then 30
    else 0
  end;
  next_locked_until := case when delay_seconds > 0 then now() + make_interval(secs => delay_seconds) else null end;

  update public.security_profiles
  set failed_pin_attempt_count = next_attempts,
      locked_until = next_locked_until,
      updated_at = now()
  where user_id = p_user_id;

  return query select next_attempts, next_locked_until, true;
end;
$$;

-- Generic fixed-window rate limiter. An advisory transaction lock serializes
-- a single user's bucket without blocking unrelated users.
create or replace function public.consume_security_rate_limit(
  p_user_id uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer
)
returns table (allowed boolean, attempts integer, retry_after integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_row public.security_rate_limits%rowtype;
  next_count integer;
  next_blocked timestamptz;
  window_start timestamptz;
begin
  if p_limit < 1 or p_window_seconds < 1 or p_block_seconds < 1 or length(p_bucket) not between 1 and 120 then
    raise exception 'invalid rate-limit configuration';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_bucket, 0));
  select * into current_row
  from public.security_rate_limits
  where user_id = p_user_id and bucket = p_bucket;

  if found and current_row.blocked_until is not null and current_row.blocked_until > now() then
    return query select false, current_row.attempt_count,
      greatest(1, ceil(extract(epoch from (current_row.blocked_until - now())))::integer);
    return;
  end if;

  if not found or current_row.window_started_at <= now() - make_interval(secs => p_window_seconds) then
    next_count := 1;
    window_start := now();
  else
    next_count := current_row.attempt_count + 1;
    window_start := current_row.window_started_at;
  end if;

  next_blocked := case when next_count > p_limit then now() + make_interval(secs => p_block_seconds) else null end;

  insert into public.security_rate_limits (
    user_id, bucket, attempt_count, window_started_at, blocked_until, updated_at
  ) values (
    p_user_id, p_bucket, next_count, window_start, next_blocked, now()
  )
  on conflict (user_id, bucket) do update set
    attempt_count = excluded.attempt_count,
    window_started_at = excluded.window_started_at,
    blocked_until = excluded.blocked_until,
    updated_at = excluded.updated_at;

  return query select next_count <= p_limit, next_count,
    case when next_blocked is null then 0 else p_block_seconds end;
end;
$$;

alter table public.security_profiles enable row level security;
alter table public.user_authenticators enable row level security;
alter table public.webauthn_challenges enable row level security;
alter table public.app_unlock_sessions enable row level security;
alter table public.security_events enable row level security;
alter table public.security_step_up_proofs enable row level security;
alter table public.security_rate_limits enable row level security;
alter table public.security_alerts enable row level security;

revoke all on table public.security_profiles from anon, authenticated;
revoke all on table public.user_authenticators from anon, authenticated;
revoke all on table public.webauthn_challenges from anon, authenticated;
revoke all on table public.app_unlock_sessions from anon, authenticated;
revoke all on table public.security_events from anon, authenticated;
revoke all on table public.security_step_up_proofs from anon, authenticated;
revoke all on table public.security_rate_limits from anon, authenticated;
revoke all on table public.security_alerts from anon, authenticated;
revoke all on function public.claim_pin_attempt(uuid) from public, anon, authenticated;
revoke all on function public.consume_security_rate_limit(uuid, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_pin_attempt(uuid) to service_role;
grant execute on function public.consume_security_rate_limit(uuid, text, integer, integer, integer) to service_role;

-- The staged enforcement script removes any prior direct event-feed grant
-- after the new App Lock-aware client is live.
drop policy if exists "Users can read their security events" on public.security_events;
create policy "Users can read their security events" on public.security_events
for select to authenticated using ((select auth.uid()) = user_id);
