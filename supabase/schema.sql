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
