alter table public.app_unlock_sessions
drop constraint if exists app_unlock_sessions_method;

alter table public.app_unlock_sessions
add constraint app_unlock_sessions_method
check (authentication_method in ('device', 'pin', 'recovery', 'pin_change'));
