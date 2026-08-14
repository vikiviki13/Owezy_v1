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

-- Accounts that existed before server-backed onboarding were already using
-- the application, so preserve their completed state during this migration.
insert into public.profiles (user_id, onboarding_completed, onboarding_completed_at)
select id, true, now()
from auth.users
on conflict (user_id) do update
set onboarding_completed = true,
    onboarding_completed_at = coalesce(public.profiles.onboarding_completed_at, now()),
    updated_at = now();

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
